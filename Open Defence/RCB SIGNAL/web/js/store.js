// Stan aplikacji i maszyna stanów scenariusza demonstracyjnego.
// Każdy etap jest wywoływany przez prezentera — nic nie przeskakuje automatycznie.

import { analyzeAlert, buildSuggestion } from './analyzer.js';
import { correlate } from './correlate.js';

const STORAGE_KEY = 'rcb-signal-demo-v1';
export const OPERATOR = { id: 'OP-07', role: 'Dyżurny operacyjny' };

export const STAGES = [
  { label: 'Scenariusz nieaktywny', hint: 'Kliknij ▶ Start demo, aby załadować dane scenariusza.' },
  { label: 'Wykrycie zdarzenia', hint: 'Otwórz zdarzenie EVT-2026-1042 „Intensywne opady / podtopienia”.' },
  { label: 'Analiza zdarzenia', hint: 'Przejrzyj źródła i mapę, następnie kliknij „Przygotuj projekt alertu”.' },
  { label: 'Projekt alertu', hint: 'Kliknij „Analizuj”, aby sprawdzić jakość komunikatu.' },
  { label: 'Analiza jakości', hint: 'Zastosuj rekomendację SIGNAL i obserwuj zmianę wyniku.' },
  { label: 'Komunikat poprawiony', hint: 'Kliknij „Przekaż do zatwierdzenia”.' },
  { label: 'Zatwierdzanie', hint: 'Potwierdź weryfikację i kliknij „Zatwierdź i symuluj wysyłkę”.' },
  { label: 'Alert w dystrybucji', hint: 'Kliknij „Następny etap scenariusza”, aby wprowadzić nowe dane (18:30).' },
  { label: 'Zmiana sytuacji', hint: 'Otwórz zdarzenie i kliknij „Otwórz proces aktualizacji”.' },
  { label: 'Aktualizacja alertu', hint: 'Przeanalizuj aktualizację, przekaż do zatwierdzenia i zatwierdź.' },
  { label: 'Aktualizacja wysłana', hint: 'Zamknij zdarzenie (widok zdarzenia → „Zamknij zdarzenie”).' },
  { label: 'Zdarzenie zamknięte', hint: 'Otwórz raport po zdarzeniu (AAR) w module Raporty.' },
  { label: 'Raport AAR', hint: 'Scenariusz zakończony. „Reset demo” przywraca stan początkowy.' },
];

let data = null;
let state = null;
const listeners = new Set();

function initialState() {
  return {
    stage: 0,
    clock: '17:40',
    phase: 'T1',
    eventOpened: false,
    closed: false,
    aarReady: false,
    activeDraftId: null,
    drafts: {},
    sent: [],
    audit: [],
    dupDecision: null,   // 'merged' | 'separate' — decyzja dyżurnego o możliwym duplikacie
    revoked: [],         // zdarzenia, dla których dyżurny zaplanował odwołanie alertu
    outage: null,        // id źródła, które przestało odpowiadać (symulacja awarii)
  };
}

let corr = null; // wynik algorytmu łączenia meldunków (SIGNAL INTELLIGENCE)

export function init(dataset) {
  data = dataset;
  corr = correlate(data.sources, data.events, (id) => data.areas.features.find((f) => f.id === id)?.properties.label || id);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    state = saved && saved.version === data.meta.version ? saved.state : initialState();
  } catch {
    state = initialState();
  }
}

export const getData = () => data;
export const getState = () => state;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: data.meta.version, state }));
  } catch { /* tryb prywatny / brak dostępu — demo działa bez trwałości */ }
}

function commit() {
  persist();
  listeners.forEach((fn) => fn(state));
}

function log(time, who, what, why = '', basis = '', kind = 'decision') {
  state.audit.push({ time, who, what, why, basis, kind });
}

// Powiadomienia nie zmieniają stanu scenariusza — nie wymuszają ponownego renderowania widoku
// (dzięki temu nie przerywają animacji).
const toastListeners = new Set();
export const onToast = (fn) => (toastListeners.add(fn), () => toastListeners.delete(fn));
export function toast(message, tone = 'info') {
  toastListeners.forEach((fn) => fn({ id: Date.now() + Math.random(), message, tone }));
}

// ---------------------------------------------------------------- selektory

export const mainEvent = () => data.events.find((e) => e.id === data.meta.mainEventId);
export const areaById = (id) => data.areas.features.find((f) => f.id === id);
export const areaList = () => data.areas.features.map((f) => ({ id: f.id, stem: f.properties.stem, label: f.properties.label }));

export function visibleEvents() {
  const dupId = duplicateFor(data.meta.mainEventId)?.id;
  return data.events.filter((e) => (e.id !== data.meta.mainEventId || state.stage >= 1) && !(e.id === dupId && state.dupDecision === 'merged'));
}

export function eventView(ev) {
  if (ev.id !== data.meta.mainEventId) {
    // Decyzje dyżurnego dotyczące innych zdarzeń: rozdzielenie duplikatu, odwołanie alertu.
    const out = { ...ev };
    if (ev.id === duplicateFor(data.meta.mainEventId)?.id && state.dupDecision === 'separate') out.requiresReview = false;
    if ((state.revoked || []).includes(ev.id)) { out.alertState = 'none'; out.updateRecommended = false; out.note = 'Alert odwołany przez dyżurnego'; }
    return out;
  }
  const s = state.stage;
  const live = state.sent.filter((a) => a.eventId === ev.id);
  return {
    ...ev,
    status: state.closed ? 'closed' : 'active',
    alertState: live.length ? 'sent' : state.activeDraftId ? 'draft' : 'none',
    requiresReview: s >= 1 && s < 7,
    updateRecommended: s === 8,
    situationChanged: s >= 8 && s < 10,
    closedAt: state.closed ? '19:15' : undefined,
  };
}

export function counters() {
  const evs = visibleEvents().map(eventView).filter((e) => e.status === 'active');
  return {
    active: evs.length,
    review: evs.filter((e) => e.requiresReview).length,
    preparation: evs.filter((e) => e.alertState === 'draft').length,
    updates: evs.filter((e) => e.updateRecommended).length,
  };
}

export const duplicateFor = (eventId) => corr.duplicates[eventId] || null;
export const correlationFor = (eventId) => corr.explain[eventId] || null;

/** Meldunki zdarzenia według algorytmu łączenia (z uwzględnieniem fazy scenariusza). */
export function sourcesFor(eventId) {
  const phases = state.phase === 'T2' ? ['T0', 'T1', 'T2'] : ['T0', 'T1'];
  const ids = corr.byEvent[eventId] || [];
  return data.sources
    .filter((s) => ids.includes(s.id) && phases.includes(s.phase))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function incidentsNow() {
  return data.incidents.filter((i) => i.phase === 'T1' || (state.phase === 'T2' && i.phase === 'T2'));
}

/** Pokrycie obszaru zagrożenia przez obszar alertu (dane zagregowane, bez danych osobowych). */
export function geoAnalysis(areaIds, phase = state.phase) {
  let exposedTotal = 0, exposedCovered = 0, alerted = 0;
  const gaps = [];
  for (const f of data.areas.features) {
    const p = f.properties;
    const exposed = p.population * p.exposure[phase];
    exposedTotal += exposed;
    if (areaIds.includes(f.id)) {
      exposedCovered += exposed;
      alerted += p.population;
    } else if (p.exposure[phase] >= 0.2) {
      gaps.push({ id: f.id, label: p.label, exposure: p.exposure[phase] });
    }
  }
  const coverage = exposedTotal ? exposedCovered / exposedTotal : 0;
  const outside = alerted ? (alerted - exposedCovered) / alerted : 0;
  return { coverage, outside, alerted, gaps, passed: coverage >= 0.9 && gaps.length === 0 };
}

export function analysisContext(draft) {
  const ev = mainEvent();
  const phase = draft.kind === 'update' ? 'T2' : state.phase;
  return {
    hazardTerms: ev.hazardTerms,
    validUntil: ev.validUntil[phase],
    areas: areaList(),
    selectedAreaIds: draft.areaIds,
    writer: ev.writer[phase],
  };
}

export const activeDraft = () => (state.activeDraftId ? state.drafts[state.activeDraftId] : null);

export function estimatedReach(phase) {
  return data.distribution.operators.reduce((s, o) => s + o.share * o[phase], 0);
}

// ---------------------------------------------------------------- akcje scenariusza

export function startDemo() {
  state = initialState();
  state.stage = 1;
  state.clock = '17:56';
  log('17:42', 'IMGW', 'Przyjęto ostrzeżenie meteorologiczne 2° (SRC-0417)', 'Źródło uprawnione', 'SRC-0417', 'system');
  log('17:49', 'PSP', 'Przyjęto meldunek o 12 interwencjach (SRC-0418)', 'Źródło uprawnione', 'SRC-0418', 'system');
  log('17:53', 'WCZK', 'Przyjęto zgłoszenie zalania dróg (SRC-0419)', 'Źródło uprawnione', 'SRC-0419', 'system');
  log('17:56', 'SIGNAL', 'Powiązano 3 źródła we wspólne zdarzenie EVT-2026-1042', 'Korelacja czasowa (11 min) i geograficzna (pow. nowosądecki, m. Nowy Sącz); 3 niezależne źródła', 'SRC-0417, SRC-0418, SRC-0419', 'recommendation');
  log('17:58', 'SIGNAL', 'Źródło SRC-0420 oznaczono jako NIEZWERYFIKOWANE', 'Brak potwierdzenia przez służby; wyłączone z oceny', 'SRC-0420', 'recommendation');
  commit();
  toast('Scenariusz załadowany. SIGNAL wykrył nowe zdarzenie: EVT-2026-1042.', 'info');
}

export function resetDemo() {
  state = initialState();
  commit();
}

export function openEvent(id) {
  if (id !== data.meta.mainEventId || state.eventOpened || state.stage < 1) return;
  state.eventOpened = true;
  state.stage = Math.max(state.stage, 2);
  state.clock = '18:01';
  log('18:01', OPERATOR.id, 'Otwarto zdarzenie EVT-2026-1042 do analizy');
  commit();
}

export function createDraft() {
  const tpl = data.alerts.find((a) => a.id === 'ALR-1042-01');
  state.drafts[tpl.id] = { id: tpl.id, eventId: tpl.eventId, kind: 'initial', text: tpl.text, areaIds: [...tpl.areaIds], status: 'draft', analysis: null, analyzedText: null, scoreHistory: [] };
  state.activeDraftId = tpl.id;
  state.stage = Math.max(state.stage, 3);
  state.clock = '18:04';
  log('18:04', OPERATOR.id, `Utworzono projekt alertu ${tpl.id}`, 'Zagrożenie potwierdzone przez 3 niezależne źródła', 'EVT-2026-1042');
  commit();
}

export function updateDraftText(text) {
  const d = activeDraft();
  if (!d || d.status === 'sent') return;
  d.text = text;
  // Zapis bez ponownego renderowania — edytor zachowuje fokus podczas pisania.
  if (d.status === 'review') { d.status = 'analyzed'; commit(); } else persist();
}

export function toggleDraftArea(id) {
  const d = activeDraft();
  if (!d || d.status === 'sent') return;
  const adding = !d.areaIds.includes(id);
  d.areaIds = adding ? [...d.areaIds, id] : d.areaIds.filter((a) => a !== id);
  log(state.clock, OPERATOR.id, `${adding ? 'Dodano' : 'Usunięto'} ${areaById(id).properties.label} ${adding ? 'do obszaru' : 'z obszaru'} ${d.id}`, 'Decyzja operatora (SIGNAL GEO)', `Pokrycie ${(geoAnalysis(d.areaIds).coverage * 100).toFixed(0)}%`);
  if (d.analysis) d.analysis = analyzeAlert(d.text, analysisContext(d));
  if (d.status === 'review') d.status = 'analyzed';
  commit();
}

export function loadVariant(text) {
  const d = activeDraft();
  if (!d) return;
  d.text = text;
  d.analysis = analyzeAlert(text, analysisContext(d));
  d.analyzedText = text;
  d.status = 'analyzed';
  commit();
}

export function runAnalysis() {
  const d = activeDraft();
  const result = analyzeAlert(d.text, analysisContext(d));
  d.analysis = result;
  d.analyzedText = d.text;
  d.scoreHistory.push(result.score);
  if (d.status === 'draft' || d.status === 'review') d.status = 'analyzed';
  const t = d.kind === 'update' ? '18:33' : '18:07';
  if (d.kind === 'initial' && state.stage === 3) { state.stage = 4; state.clock = t; }
  if (d.kind === 'update') state.clock = t;
  log(t, 'SIGNAL', `Analiza jakości ${d.id}: ${result.score}/100`, result.issues.length ? `${result.issues.length} uwag(i)` : 'Brak uwag', 'Silnik regułowy rules-v1', 'recommendation');
  commit();
  return result;
}

export function applySuggestion() {
  const d = activeDraft();
  if (!d?.analysis?.suggestion) return;
  const before = d.analysis.score;
  d.text = d.analysis.suggestion;
  d.analysis = analyzeAlert(d.text, analysisContext(d));
  d.analyzedText = d.text;
  d.scoreHistory.push(d.analysis.score);
  if (d.kind === 'initial' && state.stage === 4) { state.stage = 5; state.clock = '18:08'; }
  log(state.clock, OPERATOR.id, `Zastosowano rekomendację SIGNAL w ${d.id} (${before} → ${d.analysis.score})`, 'Doprecyzowanie instrukcji i czasu obowiązywania', 'Rekomendacja rules-v1');
  commit();
  return { before, after: d.analysis.score };
}

export function submitForReview() {
  const d = activeDraft();
  if (!d.analysis || d.analyzedText !== d.text) d.analysis = analyzeAlert(d.text, analysisContext(d)), d.analyzedText = d.text;
  if (d.analysis.blocking) return false;
  d.status = 'review';
  if (d.kind === 'initial' && state.stage <= 5) { state.stage = 6; state.clock = '18:08'; }
  log(state.clock, OPERATOR.id, `Przekazano ${d.id} do zatwierdzenia`, `Wynik jakości ${d.analysis.score}/100`, d.areaIds.map((a) => areaById(a).properties.label).join(', '));
  commit();
  return true;
}

export function requestChanges(reason) {
  const d = activeDraft();
  d.status = 'analyzed';
  log(state.clock, OPERATOR.id, `Zwrócono ${d.id} do poprawy`, reason || 'Wymagane zmiany treści', d.id);
  commit();
}

export function approve(justification) {
  const d = activeDraft();
  const isUpdate = d.kind === 'update';
  const phase = isUpdate ? 'T2' : state.phase;
  const tApprove = isUpdate ? '18:35' : '18:09';
  const tSend = isUpdate ? '18:36' : '18:10';
  const geo = geoAnalysis(d.areaIds, phase);
  const srcCount = sourcesFor(d.eventId).filter((s) => s.verification === 'verified').length;
  d.status = 'sent';
  log(tApprove, OPERATOR.id, `ZATWIERDZONO ${d.id} do (symulowanej) dystrybucji`, justification,
    `Jakość ${d.analysis.score}/100 · ${srcCount} zweryfikowane źródła · pokrycie ${(geo.coverage * 100).toFixed(0)}% · ${[...d.text].length}/160 zn.`);
  const reach = estimatedReach(phase);
  state.sent.push({ id: d.id, eventId: d.eventId, kind: d.kind, text: d.text, areaIds: [...d.areaIds], score: d.analysis.score, approvedAt: tApprove, sentAt: tSend, reach, phase });
  log(tSend, 'SYSTEM', `Symulowana dystrybucja ${d.id} zakończona`, 'Środowisko demonstracyjne — brak rzeczywistej wysyłki', `Szacowany zasięg ${(reach * 100).toFixed(0)}%`, 'system');
  const del = deliveryStats(phase);
  if (del.warn) log(tSend, 'SIGNAL', `Nierówny czas dostarczenia ${d.id}: ${del.slowest.name} dociera do 95% odbiorców po ${fmtSec(del.slowest.p95)}`,
    `Najszybszy operator: ${fmtSec(del.fastest)}. Osoby w tym samym powiecie dostają alert w różnym czasie — do wyjaśnienia z operatorem`, 'Raport dystrybucji (symulacja)', 'recommendation');
  state.stage = isUpdate ? 10 : 7;
  state.clock = tSend;
  commit();
}

// ---------------------------------------------------------------- częstotliwość i dystrybucja

/** Alerty RCB, które w ciągu ostatnich 7 dni dotyczyły wskazanych powiatów (poza bieżącym zdarzeniem). */
export function alertLoad(areaIds, excludeEventId = data.meta.mainEventId) {
  const day = (d) => Date.parse(d) / 864e5;
  const today = day(data.meta.scenarioDate);
  return visibleEvents().map(eventView)
    .filter((e) => e.id !== excludeEventId && e.areaIds.some((a) => areaIds.includes(a)))
    .filter((e) => (e.alertState === 'sent' && e.status === 'active') || (e.alertState === 'sent' && e.date && today - day(e.date) <= 7))
    .map((e) => ({ id: e.id, title: e.title, region: e.region, since: e.detectedAt, note: e.note, active: e.status === 'active',
      areas: e.areaIds.filter((a) => areaIds.includes(a)).map((a) => areaById(a).properties.label) }));
}

/** Czas dostarczenia alertu przez operatorów: mediana i czas, w którym alert dotarł do 95% odbiorców (dane syntetyczne). */
export function deliveryStats(phase) {
  const rows = data.distribution.operators.map((o) => ({ name: o.name, reach: o[phase], ...o.delivery[phase] }));
  const fastest = Math.min(...rows.map((r) => r.p95));
  const slowest = rows.reduce((a, r) => (r.p95 > a.p95 ? r : a));
  const spread = slowest.p95 - Math.min(...rows.map((r) => r.p50));
  // Ostrzeżenie: najwolniejszy operator potrzebuje ponad 2x więcej czasu niż najszybszy, żeby dotrzeć do 95% odbiorców.
  return { rows, spread, slowest, fastest, warn: slowest.p95 > 2 * fastest };
}

export const fmtSec = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`);

// ---------------------------------------------------------------- stan źródeł i awaria

/** Stan kanałów danych. Przy awarii źródło ma status „brak odpowiedzi”, a system pracuje dalej na ostatnich danych. */
export function sourceHealth() {
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return data.feeds.map((f) => {
    const last = f.last[state.phase] || f.last.T1;
    const down = state.outage === f.id;
    const ago = down && last !== '—' ? toMin(state.clock) - toMin(last) : null;
    return { ...f, lastAt: last, down, ago };
  });
}
export const outageFeed = () => (state.outage ? data.feeds.find((f) => f.id === state.outage) : null);

export function setOutage(id) {
  const prev = outageFeed();
  state.outage = id;
  if (id) {
    const f = outageFeed();
    log(state.clock, 'SYSTEM', `Brak odpowiedzi źródła: ${f.name}`, 'Symulacja awarii usługi', f.desc, 'system');
    log(state.clock, 'SIGNAL', `Ocena oznaczona jako niepełna (brak danych: ${f.name})`, `Procedura zastępcza: ${f.fallback}`, 'Stan źródeł', 'recommendation');
  } else if (prev) {
    log(state.clock, 'SYSTEM', `Przywrócono połączenie: ${prev.name}`, 'Koniec symulacji awarii', prev.desc, 'system');
  }
  commit();
}

export function resolveDuplicate(choice) {
  const dupId = duplicateFor(data.meta.mainEventId).id;
  state.dupDecision = choice;
  log(state.clock, OPERATOR.id, choice === 'merged' ? `Połączono ${dupId} ze zdarzeniem ${data.meta.mainEventId}` : `Uznano ${dupId} za osobne zdarzenie`,
    choice === 'merged' ? 'Ten sam obszar (Dunajec) i nakładające się okno czasowe' : 'Inne zagrożenie mimo wspólnego obszaru — wymaga osobnej obsługi', `${dupId}, ${data.meta.mainEventId}`);
  commit();
}

export function revokeAlert(eventId) {
  state.revoked = [...(state.revoked || []), eventId];
  const ev = data.events.find((e) => e.id === eventId);
  log(state.clock, OPERATOR.id, `Zaplanowano odwołanie alertu: ${ev.title} (${eventId})`, 'Ograniczenie liczby równoległych alertów w tym samym powiecie', ev.note || eventId);
  commit();
}

export function advanceScenario() {
  if (state.stage !== 7) return;
  state.phase = 'T2';
  state.stage = 8;
  state.clock = '18:32';
  log('18:28', 'PSP', 'Przyjęto meldunek: +8 interwencji, w tym 3 w pow. limanowskim (SRC-0431)', 'Źródło uprawnione', 'SRC-0431', 'system');
  log('18:29', 'WCZK', 'Przyjęto zgłoszenie: 2 zalane drogi w pow. limanowskim (SRC-0432)', 'Źródło uprawnione', 'SRC-0432', 'system');
  log('18:30', 'IMGW', 'Przyjęto aktualizację ostrzeżenia — ważność do 23:00 (SRC-0433)', 'Źródło uprawnione', 'SRC-0433', 'system');
  const g = geoAnalysis(state.sent[0].areaIds, 'T2');
  log('18:32', 'SIGNAL', 'Wykryto ZMIANĘ SYTUACJI — rekomendacja przeglądu aktywnego alertu', `Pokrycie obszaru zagrożenia spadło do ${(g.coverage * 100).toFixed(0)}%; niezgodność godziny zakończenia (22:00 vs 23:00)`, 'SRC-0431, SRC-0432, SRC-0433', 'recommendation');
  commit();
  toast('SYTUACJA ZMIENIONA — aktywny alert może nie odzwierciedlać bieżącej sytuacji.', 'warn');
}

export function openUpdateWorkflow() {
  if (state.stage !== 8) return;
  const ev = mainEvent();
  const id = 'ALR-1042-02';
  const text = buildSuggestion(ev.writer.T2);
  state.drafts[id] = { id, eventId: ev.id, kind: 'update', text, areaIds: ['P01', 'P02', 'P03'], status: 'draft', analysis: null, analyzedText: null, scoreHistory: [] };
  state.activeDraftId = id;
  state.stage = 9;
  state.clock = '18:32';
  log('18:32', OPERATOR.id, `Otwarto proces aktualizacji — projekt ${id}`, 'Rekomendacja SIGNAL: rozszerzenie obszaru o pow. limanowski i wydłużenie do 23:00', 'SRC-0431, SRC-0432, SRC-0433');
  commit();
}

export function closeEvent() {
  if (state.stage !== 10) return;
  state.closed = true;
  state.stage = 11;
  state.clock = '19:15';
  log('19:15', OPERATOR.id, 'Zamknięto zdarzenie EVT-2026-1042', 'IMGW: koniec opadów; PSP: brak nowych interwencji od 18:58', 'Meldunki końcowe (synt.)');
  log('19:20', 'SIGNAL', 'Wygenerowano raport po zdarzeniu AAR-1042', 'Automatycznie po zamknięciu zdarzenia', 'Dziennik audytu EVT-2026-1042', 'recommendation');
  state.aarReady = true;
  commit();
}

export function openAar() {
  if (state.stage === 11) { state.stage = 12; state.clock = '19:20'; commit(); }
}

/** Raport AAR budowany z rzeczywistego przebiegu sesji (dziennik audytu). */
export function liveAar() {
  if (!state.aarReady) return null;
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const first = state.sent.find((a) => a.kind === 'initial');
  const updates = state.sent.filter((a) => a.kind === 'update');
  const issuesFound = Object.values(state.drafts).reduce((n, d) => n + (d.scoreHistory.length ? 1 : 0), 0);
  const initialDraft = state.drafts['ALR-1042-01'];
  return {
    id: 'AAR-1042', eventId: 'EVT-2026-1042', title: 'Intensywne opady / podtopienia', date: data.meta.scenarioDate, live: true,
    timeline: state.audit.filter((a) => a.kind !== 'system' || ['IMGW', 'PSP', 'WCZK'].includes(a.who)).map((a) => [a.time, a.who, a.what]),
    metrics: {
      detectionToDecisionMin: first ? toMin(first.approvedAt) - toMin('17:56') : null,
      preparationMin: first ? toMin(first.approvedAt) - toMin('18:04') : null,
      qualityScore: first ? first.score : null,
      initialScore: initialDraft?.scoreHistory[0] ?? null,
      sources: 3,
      updates: updates.length,
      reach: first ? first.reach : null,
    },
    delivery: first ? deliveryStats(first.phase) : null,
    issues: [
      'Projekt alertu nie zawierał konkretnej instrukcji działania (wykryte przed wysyłką)',
      'Brak przewidywanego czasu zakończenia w projekcie (wykryte przed wysyłką)',
      'Rozszerzenie zagrożenia na pow. limanowski — alert zaktualizowany po 4 min od rekomendacji',
      'Niezweryfikowana informacja medialna (most w Mszanie Dolnej) — poprawnie wyłączona z komunikatu',
    ],
    recommendations: [
      'Dodać pow. limanowski do obszaru wstępnego przy prognozie IMGW obejmującej jego część',
      'Utrwalić zwroty „Nie wjezdzaj na zalane drogi” / „Przenies rzeczy wyzej” w katalogu instrukcji',
      'Skrócić próg rekomendacji aktualizacji do 2 nowych zgłoszeń spoza obszaru alertu',
    ],
    issuesFound,
  };
}
