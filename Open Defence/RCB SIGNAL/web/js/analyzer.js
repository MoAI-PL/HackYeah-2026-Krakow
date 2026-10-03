// SIGNAL WRITER — deterministyczny silnik kontroli jakości komunikatu.
// Ocenia KONSTRUKCJĘ komunikatu (nie prawdziwość treści). Wynik jest w pełni
// powtarzalny: ten sam tekst + ten sam kontekst = ten sam wynik.

export const SMS_LIMIT = 160;
export const UCS2_LIMIT = 70;

// Wagi kryteriów (suma = 100).
export const WEIGHTS = {
  what: 12,
  where: 15,
  when: 15,        // odniesienie czasowe 8 + czas zakończenia 7
  action: 25,      // brak 0 / ogólna 10 / 1 konkretna 18 / ≥2 konkretne 25
  length: 10,
  consistency: 15, // terminologia 8 + zgodność czasu i obszaru 7
  clarity: 8,
};

const HAZARD_TERMS = [
  'opad', 'deszcz', 'podtop', 'zalan', 'powodz', 'wezbran', 'wiatr', 'wichur', 'porywy', 'burz',
  'grad', 'upal', 'pozar', 'zadymien', 'skazen', 'smog', 'oblodzen', 'snieg', 'mroz',
];

const SPECIFIC_ACTIONS = [
  'nie wjezdzaj', 'nie wchodz', 'nie zblizaj', 'unikaj', 'przenies', 'zabezpiecz', 'wylacz',
  'udaj sie', 'ewakuuj', 'opusc', 'pozostan w domu', 'zostan w domu', 'zamknij okna', 'nie pij',
  'przegotuj', 'naladuj', 'odsun', 'zjedz z drogi', 'nie parkuj',
];

const GENERIC_ACTIONS = ['zachowaj ostroznosc', 'uwazaj', 'badz czujny', 'sledz komunikaty', 'zachowaj czujnosc'];

const ABBREVIATIONS = /\b(pow|gm|woj|ok|godz|ul|m)\.(?=\s|$)/g;
const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const TIME_REF = /\b\d{1,2}[:.]\d{2}\b|\bdzis\b|\bjutro\b|\bwieczor|\bw nocy\b|\brano\b|\bpo poludniu\b/;
const END_TIME = /\bdo\s+(?:godziny\s+|godz\.\s*)?(\d{1,2})[:.](\d{2})\b/;

export function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * @param {string} text treść komunikatu
 * @param {object} ctx  { hazardTerms, validUntil, areas:[{id,stem,label}], selectedAreaIds, writer }
 */
export function analyzeAlert(text, ctx) {
  const raw = text.trim();
  const n = normalize(raw);
  const checks = {};
  const issues = [];
  const add = (severity, criterion, message) => issues.push({ severity, criterion, message });

  // WHAT — czy wiadomo, co się dzieje
  const hazards = HAZARD_TERMS.filter((t) => n.includes(t));
  checks.what = { status: hazards.length ? 'ok' : 'fail', points: hazards.length ? WEIGHTS.what : 0, max: WEIGHTS.what };
  if (!hazards.length) add('error', 'WHAT', 'Brak opisu zagrożenia — odbiorca nie wie, co się dzieje.');

  // WHERE — czy wiadomo, jakiego obszaru dotyczy
  const mentioned = ctx.areas.filter((a) => n.includes(a.stem));
  const mentionedIds = [...new Set(mentioned.map((a) => a.id))];
  checks.where = { status: mentioned.length ? 'ok' : 'fail', points: mentioned.length ? WEIGHTS.where : 0, max: WEIGHTS.where };
  if (!mentioned.length) add('error', 'WHERE', 'Brak nazwy obszaru — odbiorca nie wie, czy komunikat go dotyczy.');

  // WHEN — odniesienie czasowe + przewidywane zakończenie
  const endMatch = n.match(END_TIME);
  const hasRef = TIME_REF.test(n) || !!endMatch;
  let whenPts = (hasRef ? 8 : 0) + (endMatch ? 7 : 0);
  checks.when = { status: whenPts === WEIGHTS.when ? 'ok' : whenPts ? 'warn' : 'fail', points: whenPts, max: WEIGHTS.when };
  if (!hasRef) add('error', 'WHEN', 'Brak informacji o czasie obowiązywania zagrożenia.');
  else if (!endMatch) add('warn', 'WHEN', 'Brak informacji o przewidywanym zakończeniu (np. „Do 22:00”).');

  // ACTION — czy odbiorca wie, co zrobić
  const specific = SPECIFIC_ACTIONS.filter((a) => n.includes(a));
  const generic = GENERIC_ACTIONS.filter((a) => n.includes(a));
  let actionPts = 0;
  if (specific.length >= 2) actionPts = 25;
  else if (specific.length === 1) actionPts = 18;
  else if (generic.length) actionPts = 10;
  checks.action = { status: actionPts === 25 ? 'ok' : actionPts ? 'warn' : 'fail', points: actionPts, max: WEIGHTS.action };
  if (!actionPts) add('error', 'ACTION', 'Brak instrukcji działania — odbiorca może nie wiedzieć, co zrobić.');
  else if (actionPts === 10) add('warn', 'ACTION', `Instrukcja zbyt ogólna („${generic[0]}”) — wskaż konkretne działanie.`);
  else if (actionPts === 18) add('info', 'ACTION', 'Rozważ drugą konkretną instrukcję (np. zabezpieczenie mienia).');

  // LENGTH — limit SMS i kodowanie GSM-7
  const len = [...raw].length;
  const ucs2 = DIACRITICS.test(raw);
  let lengthPts = WEIGHTS.length;
  let lengthStatus = 'ok';
  if (len > SMS_LIMIT) {
    lengthPts = 0; lengthStatus = 'fail';
    add('error', 'LENGTH', `Przekroczony limit znaków: ${len} / ${SMS_LIMIT}.`);
  } else if (ucs2) {
    lengthPts = 5; lengthStatus = 'warn';
    const segments = len <= UCS2_LIMIT ? 1 : Math.ceil(len / 67);
    add('warn', 'LENGTH', `Polskie znaki wymuszą kodowanie UCS-2 (limit ${UCS2_LIMIT} znaków) — ${segments > 1 ? `komunikat zostanie podzielony na ${segments} segmenty SMS` : 'zalecany zapis bez polskich znaków'}.`);
  }
  checks.length = { status: lengthStatus, points: lengthPts, max: WEIGHTS.length, chars: len, limit: SMS_LIMIT, ucs2 };

  // CONSISTENCY — zgodność z danymi zdarzenia i poprzednimi komunikatami
  let consPts = 0;
  const foreign = hazards.filter((h) => !ctx.hazardTerms.some((t) => t === h));
  const termsOk = hazards.length > 0 && foreign.length === 0;
  if (termsOk) consPts += 8;
  else if (foreign.length) add('warn', 'CONSISTENCY', `Terminologia niezgodna ze zdarzeniem: „${foreign.join('”, „')}”.`);
  let factsOk = true;
  if (endMatch && ctx.validUntil) {
    const end = `${endMatch[1].padStart(2, '0')}:${endMatch[2]}`;
    if (toMinutes(end) !== toMinutes(ctx.validUntil)) {
      factsOk = false;
      add('warn', 'CONSISTENCY', `Godzina zakończenia (${end}) niezgodna z ostrzeżeniem źródłowym (${ctx.validUntil}).`);
    }
  }
  const outside = mentionedIds.filter((id) => !ctx.selectedAreaIds.includes(id));
  if (outside.length) {
    factsOk = false;
    const labels = ctx.areas.filter((a) => outside.includes(a.id)).map((a) => a.label);
    add('error', 'CONSISTENCY', `Treść wymienia obszar spoza zasięgu dystrybucji: ${labels.join(', ')}.`);
  }
  if (factsOk && hazards.length) consPts += 7;
  checks.consistency = { status: consPts === WEIGHTS.consistency ? 'ok' : consPts ? 'warn' : 'fail', points: consPts, max: WEIGHTS.consistency };

  // CLARITY — skróty i zapis utrudniający zrozumienie
  const abbr = raw.match(ABBREVIATIONS) || [];
  checks.clarity = { status: abbr.length ? 'warn' : 'ok', points: abbr.length ? 0 : WEIGHTS.clarity, max: WEIGHTS.clarity };
  if (abbr.length) add('info', 'CLARITY', `Skrót ${[...new Set(abbr)].map((a) => `„${a}”`).join(', ')} — użyj pełnej nazwy, jeśli limit znaków pozwala.`);

  const score = Object.values(checks).reduce((s, c) => s + c.points, 0);
  const blocking = issues.some((i) => i.severity === 'error');
  const suggestion = score < 90 && ctx.writer ? buildSuggestion(ctx.writer) : null;

  return {
    engine: 'rules-v1',
    score,
    checks,
    issues,
    blocking,
    suggestion,
    // Zgodność ze schematem z koncepcji (structured output)
    schema: {
      what: checks.what.status === 'ok',
      where: checks.where.status === 'ok',
      when: checks.when.status === 'ok',
      action: checks.action.status === 'ok',
      consistency: checks.consistency.status === 'ok',
      length_ok: checks.length.status !== 'fail',
      score,
      issues: issues.map((i) => i.message),
      suggestion,
    },
  };
}

// Rekomendowana wersja budowana z szablonu zdarzenia — bez polskich znaków (GSM-7)
// i z kontrolą limitu: gdy tekst się nie mieści, pomijany jest numer alarmowy.
export function buildSuggestion(w) {
  const parts = [`Alert RCB: ${w.prefix || ''}Do ${w.until} ${w.hazardPhrase} w ${w.areaPhrase}.`, ...w.actions];
  const withEmergency = [...parts, w.emergency].join(' ');
  return [...withEmergency].length <= SMS_LIMIT ? withEmergency : parts.join(' ');
}
