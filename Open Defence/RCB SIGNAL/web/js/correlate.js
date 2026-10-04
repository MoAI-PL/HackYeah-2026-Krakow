// SIGNAL INTELLIGENCE — łączenie meldunków w zdarzenia.
// Jawne reguły zamiast przypisania „na sztywno”: dwa meldunki trafiają do jednego zdarzenia,
// gdy dotyczą wspólnego powiatu, mieszczą się w oknie czasowym i opisują to samo zagrożenie
// (albo jeden z nich nie nazywa zagrożenia wprost). Wynik jest powtarzalny i da się go wyjaśnić.

import { normalize } from './analyzer.js';

export const WINDOW_MIN = 60;

// Słownik zagrożeń (rdzenie słów po normalizacji: małe litery, bez polskich znaków).
export const HAZARDS = {
  water: { label: 'skażenie wody', terms: ['skazen', 'wodociag', 'beczkowoz', 'przegot', 'pitnej'] },
  hydro: { label: 'opady i podtopienia', terms: ['opad', 'deszcz', 'podtop', 'zalan', 'powodz', 'wezbran', 'wypompow', 'zerwany most', 'stan wody'] },
  wind: { label: 'silny wiatr', terms: ['wiatr', 'wichur', 'porywy'] },
  fire: { label: 'pożar', terms: ['pozar', 'zadymien'] },
  heat: { label: 'upał', terms: ['upal'] },
};
const CATEGORY = { 'hydro': 'hydro', 'hydro-meteo': 'hydro', 'pożar': 'fire', 'zdrowie': 'water' };

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** Rodzaj zagrożenia w meldunku albo null, gdy tekst go nie nazywa (np. prośba o alert, pomiar). */
export function classify(text) {
  const n = normalize(text);
  return Object.keys(HAZARDS).find((k) => HAZARDS[k].terms.some((t) => n.includes(t))) || null;
}

/** Rodzaj zagrożenia zdarzenia: z jego terminologii, a gdy jej nie ma — z kategorii. */
export function eventClass(ev) {
  if (ev.hazardTerms?.length) return classify(ev.hazardTerms.join(' ')) || CATEGORY[ev.category] || null;
  return CATEGORY[ev.category] || classify(ev.title);
}

/** Reguła łączenia dwóch meldunków. */
export function linked(a, b) {
  const shared = a.areaIds.some((x) => b.areaIds.includes(x));
  const close = Math.abs(toMin(a.time) - toMin(b.time)) <= WINDOW_MIN;
  const sameHazard = !a.cls || !b.cls || a.cls === b.cls;
  return shared && close && sameHazard;
}

/**
 * @param sources meldunki ({id, time, areaIds, title, body, source, verification})
 * @param events  katalog zdarzeń (do nazwania grup i wskazania możliwych duplikatów)
 * @param areaLabel funkcja id powiatu → etykieta
 */
export function correlate(sources, events, areaLabel = (x) => x) {
  const items = sources.map((s) => ({ ...s, cls: classify(`${s.title} ${s.body}`) }));
  // Grupowanie: union-find po parach spełniających regułę (łączenie przechodnie).
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) if (linked(items[i], items[j])) parent[find(i)] = find(j);
  }
  const groups = new Map();
  items.forEach((s, i) => { const r = find(i); groups.set(r, [...(groups.get(r) || []), s]); });

  const byEvent = {};
  const explain = {};
  const taken = new Set();
  for (const members of groups.values()) {
    const counts = {};
    members.forEach((s) => { if (s.cls) counts[s.cls] = (counts[s.cls] || 0) + 1; });
    const cls = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
    const start = Math.min(...members.map((s) => toMin(s.time)));
    // Nazwanie grupy: zdarzenie tego samego rodzaju z największym pokryciem powiatów (ważonym liczbą meldunków).
    const cands = events.filter((e) => !taken.has(e.id) && eventClass(e) === cls).map((e) => ({
      e,
      overlap: members.reduce((n, s) => n + s.areaIds.filter((a) => e.areaIds.includes(a)).length, 0),
      dt: Math.abs(toMin(e.detectedAt) - start),
    })).filter((c) => c.overlap > 0).sort((a, b) => b.overlap - a.overlap || a.dt - b.dt);
    if (!cands.length) continue;
    const ev = cands[0].e;
    taken.add(ev.id);
    byEvent[ev.id] = members.map((s) => s.id);
    const common = [...new Set(members.flatMap((s) => s.areaIds))].filter((a) => members.filter((s) => s.areaIds.includes(a)).length > 1);
    const times = members.map((s) => toMin(s.time));
    const services = [...new Set(members.filter((s) => s.verification === 'verified').map((s) => s.source))];
    explain[ev.id] = {
      hazard: cls ? HAZARDS[cls].label : 'nieokreślone',
      areas: common.map(areaLabel),
      spanMin: Math.max(...times) - Math.min(...times),
      services,
      unclassified: members.filter((s) => !s.cls).map((s) => s.id),
    };
  }

  // Możliwy duplikat: zdarzenie bez własnych meldunków, ten sam rodzaj zagrożenia, wspólny powiat, zbliżony czas.
  const duplicates = {};
  for (const id of Object.keys(byEvent)) {
    const ev = events.find((e) => e.id === id);
    const dup = events.find((e) => !byEvent[e.id] && e.status === 'active' && eventClass(e) === eventClass(ev)
      && e.areaIds.some((a) => ev.areaIds.includes(a)) && Math.abs(toMin(e.detectedAt) - toMin(ev.detectedAt)) <= 2 * WINDOW_MIN);
    if (dup) {
      const shared = dup.areaIds.filter((a) => ev.areaIds.includes(a)).map(areaLabel);
      duplicates[id] = { id: dup.id, title: dup.title, reason: `Wspólny obszar (${shared.join(', ')}), to samo zagrożenie (${HAZARDS[eventClass(ev)].label}), zgłoszenie o ${dup.detectedAt}.` };
    }
  }
  return { byEvent, explain, duplicates, classes: Object.fromEntries(items.map((s) => [s.id, s.cls])) };
}
