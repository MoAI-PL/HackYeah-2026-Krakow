// Testy deterministycznego silnika SIGNAL WRITER i maszyny stanów scenariusza.
// Uruchomienie (wymaga Node 18+): node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeAlert, buildSuggestion } from '../web/js/analyzer.js';

const data = JSON.parse(readFileSync(new URL('../data/demo-events.json', import.meta.url)));
const ev = data.events.find((e) => e.id === data.meta.mainEventId);
const areas = data.areas.features.map((f) => ({ id: f.id, stem: f.properties.stem, label: f.properties.label }));
const ctx = (phase, selected = ['P01', 'P02']) => ({
  hazardTerms: ev.hazardTerms, validUntil: ev.validUntil[phase], areas, selectedAreaIds: selected, writer: ev.writer[phase],
});
const variant = (id) => data.testVariants.find((v) => v.id === id).text;

test('projekt wyjściowy: 78/100, ogólna instrukcja i brak czasu zakończenia', () => {
  const r = analyzeAlert(data.alerts[0].text, ctx('T1'));
  assert.equal(r.score, 78);
  assert.equal(r.checks.action.status, 'warn');
  assert.equal(r.checks.when.status, 'warn');
  assert.equal(r.blocking, false);
  assert.ok(r.suggestion);
});

test('rekomendacja SIGNAL: 92/100, mieści się w limicie, bez polskich znaków', () => {
  const s = analyzeAlert(data.alerts[0].text, ctx('T1')).suggestion;
  const r = analyzeAlert(s, ctx('T1'));
  assert.equal(r.score, 92);
  assert.ok([...s].length <= 160);
  assert.doesNotMatch(s, /[ąćęłńóśźż]/i);
});

test('wynik jest deterministyczny', () => {
  const a = analyzeAlert(data.alerts[0].text, ctx('T1'));
  const b = analyzeAlert(data.alerts[0].text, ctx('T1'));
  assert.deepEqual(a, b);
});

test('błąd: przekroczony limit 173/160 blokuje zatwierdzenie', () => {
  const r = analyzeAlert(variant('too-long'), ctx('T1'));
  assert.equal(r.checks.length.chars, 173);
  assert.equal(r.checks.length.status, 'fail');
  assert.equal(r.blocking, true);
});

test('błąd: brak instrukcji działania blokuje zatwierdzenie', () => {
  const r = analyzeAlert(variant('no-action'), ctx('T1'));
  assert.equal(r.checks.action.status, 'fail');
  assert.equal(r.blocking, true);
});

test('ostrzeżenie: polskie znaki (UCS-2)', () => {
  const r = analyzeAlert(variant('diacritics'), ctx('T1'));
  assert.equal(r.checks.length.ucs2, true);
  assert.equal(r.checks.length.status, 'warn');
});

test('po zmianie sytuacji wysłany alert jest niespójny z IMGW (22:00 vs 23:00)', () => {
  const sent = analyzeAlert(data.alerts[0].text, ctx('T1')).suggestion;
  const r = analyzeAlert(sent, ctx('T2'));
  assert.equal(r.checks.consistency.status, 'warn');
  assert.ok(r.score < 92);
});

test('treść wymieniająca obszar spoza dystrybucji jest błędem', () => {
  const update = buildSuggestion(ev.writer.T2);
  const r = analyzeAlert(update, ctx('T2', ['P01', 'P02']));
  assert.equal(r.blocking, true);
  assert.ok(r.issues.some((i) => i.message.includes('pow. limanowski')));
});

test('aktualizacja z pełnym obszarem: 92/100', () => {
  const r = analyzeAlert(buildSuggestion(ev.writer.T2), ctx('T2', ['P01', 'P02', 'P03']));
  assert.equal(r.score, 92);
  assert.equal(r.blocking, false);
});

test('pełny scenariusz: 12 etapów, audyt i raport AAR', async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const store = await import('../web/js/store.js');
  store.init(data);
  store.startDemo();
  store.openEvent('EVT-2026-1042');
  store.createDraft();
  assert.equal(store.runAnalysis().score, 78);
  assert.deepEqual(store.applySuggestion(), { before: 78, after: 92 });
  assert.equal(store.submitForReview(), true);
  store.approve('test');
  assert.equal(store.getState().stage, 7);
  assert.ok(store.geoAnalysis(['P01', 'P02'], 'T1').passed);
  store.advanceScenario();
  assert.equal(store.geoAnalysis(['P01', 'P02'], 'T2').passed, false);
  store.openUpdateWorkflow();
  store.runAnalysis();
  assert.equal(store.submitForReview(), true);
  store.approve('aktualizacja');
  store.closeEvent();
  store.openAar();
  const s = store.getState();
  assert.equal(s.stage, 12);
  assert.equal(s.sent.length, 2);
  assert.ok(s.audit.every((a) => a.time && a.who && a.what));
  const aar = store.liveAar();
  assert.equal(aar.metrics.qualityScore, 92);
  assert.equal(aar.metrics.initialScore, 78);
  assert.equal(aar.metrics.updates, 1);
});

test('dane demo: wymagane minimum', () => {
  assert.ok(data.meta.synthetic);
  assert.ok(data.events.length >= 5);
  assert.ok(data.sources.length >= 15);
  assert.ok(data.alerts.length >= 5);
  assert.ok(data.areas.features.length >= 3);
  assert.ok(data.afterActionReports.length + 1 >= 3);
});

// ---------------------------------------------------------------- SIGNAL INTELLIGENCE: łączenie meldunków
import { correlate, classify, linked } from '../web/js/correlate.js';

test('łączenie meldunków: algorytm odtwarza przypisanie eksperckie 17/17', () => {
  const r = correlate(data.sources, data.events);
  for (const s of data.sources) {
    const got = Object.keys(r.byEvent).find((k) => r.byEvent[k].includes(s.id));
    assert.equal(got, s.expertEventId, `${s.id}: ${got} zamiast ${s.expertEventId}`);
  }
});

test('łączenie meldunków: reguły obszaru, czasu i rodzaju zagrożenia', () => {
  const base = { time: '17:00', areaIds: ['P01'], cls: 'hydro' };
  assert.equal(linked(base, { ...base, time: '17:45' }), true);
  assert.equal(linked(base, { ...base, time: '18:30' }), false, 'poza oknem 60 min');
  assert.equal(linked(base, { ...base, areaIds: ['P06'] }), false, 'inny powiat');
  assert.equal(linked(base, { ...base, cls: 'wind' }), false, 'inne zagrożenie');
  assert.equal(linked(base, { ...base, cls: null }), true, 'meldunek bez nazwanego zagrożenia dołącza po obszarze i czasie');
  assert.equal(classify('Skażenie bakteriologiczne wody — wodociąg'), 'water');
  assert.equal(classify('Prośba o rozważenie Alertu RCB'), null);
});

test('możliwy duplikat jest wyliczany, a nie wpisany w dane', () => {
  assert.ok(data.events.every((e) => !('duplicateCandidate' in e)));
  const r = correlate(data.sources, data.events);
  assert.equal(r.duplicates['EVT-2026-1042'].id, 'EVT-2026-1037');
});

test('dystrybucja, obciążenie alertami i awaria źródła', async () => {
  const store = await import('../web/js/store.js');
  store.init(data);
  store.resetDemo?.();
  store.startDemo();
  const del = store.deliveryStats('T1');
  assert.equal(del.warn, true);
  assert.equal(del.slowest.name, 'Operator C');
  assert.deepEqual(store.alertLoad(['P01', 'P02']).map((x) => x.id), ['EVT-2026-1038']);
  store.setOutage('IMGW');
  assert.equal(store.sourceHealth().find((f) => f.id === 'IMGW').down, true);
  assert.ok(store.getState().audit.some((a) => a.what.includes('Ocena oznaczona jako niepełna')));
  store.setOutage(null);
  assert.equal(store.sourceHealth().every((f) => !f.down), true);
});
