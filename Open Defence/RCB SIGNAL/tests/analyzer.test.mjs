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
  assert.ok(r.issues.some((i) => i.message.includes('pow. lipnicki')));
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
