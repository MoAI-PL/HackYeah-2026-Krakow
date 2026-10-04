// SCREEN 9–10 — SIGNAL FEEDBACK: mierzalność i uczenie się systemu.

import * as store from '../store.js';
import { esc, pageHead, panel, compareChart, bindChartTips } from '../ui.js';
import { analyzeAlert } from '../analyzer.js';

// Test historyczny: prawdziwe treści Alertów RCB (data/historical-alerts.json) przepuszczone przez te same reguły co projekty w demo.
let hist = null;
let histLoading = false;
function loadHist(refresh) {
  if (hist || histLoading) return;
  histLoading = true;
  fetch('data/historical-alerts.json').then((r) => r.json()).then((j) => { hist = j; refresh(); }).catch(() => { histLoading = false; });
}

function histPanel() {
  if (!hist) return '';
  const rows = hist.alerts.map((a) => {
    const r = analyzeAlert(a.text, { hazardTerms: [], validUntil: null, areas: [], selectedAreaIds: [], writer: null });
    return { ...a, chars: r.checks.length.chars, until: /\bdo\s+(godz\.?\s*)?\d{1,2}[.:]\d{2}/i.test(a.text), action: r.checks.action.points >= 18, link: /https?:\/\/|www\./.test(a.text) };
  });
  const noUntil = rows.filter((r) => !r.until).length;
  const yes = '<span class="ico ok">✓</span>', no = '<span class="ico fail">✕</span>';
  return `<section class="ov-section"><h2 class="ov-h2">Test historyczny: ${rows.length} prawdziwych Alertów RCB</h2>
    <dl class="ov-stats">
      <div class="ov-stat red"><dt>Bez informacji „do kiedy”</dt><dd>${noUntil} z ${rows.length}</dd></div>
      <div class="ov-stat amber"><dt>Konkretna instrukcja wykryta regułami</dt><dd>${rows.filter((r) => r.action).length} z ${rows.length}</dd></div>
      <div class="ov-stat amber"><dt>Link zamiast instrukcji</dt><dd>${rows.filter((r) => r.link).length} z ${rows.length}</dd></div>
      <div class="ov-stat"><dt>Ponad 160 znaków (w cytowanej treści)</dt><dd>${rows.filter((r) => r.chars > 160).length} z ${rows.length}</dd></div>
    </dl>
    ${panel('Treści i wynik reguł', `<div class="table-wrap"><table>
      <thead><tr><th>Data</th><th>Treść alertu</th><th class="num">Znaki</th><th>Do kiedy</th><th>Instrukcja</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td class="mono">${esc(r.date)}</td><td style="font-size:13px">${esc(r.text)}<div class="faint" style="font-size:12px">${esc(r.area)}</div></td>
        <td class="num">${r.chars}</td><td>${r.until ? yes : no}</td><td>${r.action ? yes : no}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:13px;padding:0 18px 16px;margin:10px 0 0">Źródło: ${esc(hist.source)} Instrukcję wykrywa słownik reguł; przy ręcznej ocenie konkretną instrukcję ma więcej alertów (np. „Utrzymuj zwierzęta w zamknięciu”, „nie podnoś, powiadom Policję”) — rozbudowa słownika to zadanie na test historyczny w pilotażu.</p>`, { bodyClass: 'tight' })}
  </section>`;
}

export function render() {
  const b = store.getData().benchmarks;
  const charts = [
    ['Jakość komunikatu', 'Actionability score (0–100)', b.quality, 'higher'],
    ['Czas przygotowania', 'Od otwarcia zdarzenia do zatwierdzenia', b.preparation, 'lower'],
    ['Zrozumienie instrukcji', 'Odsetek poprawnych odpowiedzi w teście zrozumiałości', b.understanding, 'higher'],
  ].map(([title, sub, m, better]) => panel(title, `<div class="muted" style="font-size:12.5px;margin-bottom:10px">${sub}</div>
    ${compareChart({ title, unit: m.unit, max: m.max, better, rows: [{ label: 'Baseline', value: m.baseline }, { label: 'RCB SIGNAL', value: m.signal, highlight: true }] })}
`)).join('');

  // Cztery najważniejsze KPI pilotażu: duży cel, pod nim wynik w scenariuszu demonstracyjnym.
  // Etykieta KPI dzielona na nazwę i doprecyzowanie z nawiasu, np. „Zrozumienie instrukcji (test zrozumiałości)”.
  const kpi = `<section class="ov-section"><h2 class="ov-h2">Cele pilotażu</h2><div class="kpi-grid six">
    ${b.kpi.map(([k, target, val]) => {
      const [name, note] = k.replace(')', '').split(' (');
      return `<div class="kpi-card">
        <div class="kpi-name">${esc(name)}</div>
        ${note ? `<div class="kpi-note">${esc(note)}</div>` : ''}
        <div class="kpi-target">${esc(target)}</div>
        <div class="kpi-foot"><span>Cel pilotażu</span><span class="kpi-demo ${val === 'nie badano' ? 'na' : ''}">${val === 'nie badano' ? 'Wymaga badania z odbiorcami' : `W demo: <b>${esc(val)}</b>`}</span></div>
      </div>`;
    }).join('')}
  </div></section>`;

  const L = b.learning;
  const max = Math.max(...L.issues.map((i) => i[1]));
  const learning = panel('Uczenie się systemu', `<div class="muted" style="font-size:13px;margin-bottom:10px">Najczęstsze problemy wykryte w <b>${L.events}</b> symulowanych zdarzeniach (odsetek projektów alertów):</div>
    ${L.issues.map(([l, v], i) => `<div class="hbar" data-tip="${esc(`${l}: ${v}% projektów`)}"><span>${i + 1}. ${esc(l)}</span><span class="track"><i style="width:${(v / max) * 100}%"></i></span><span class="mono num">${v}%</span></div>`).join('')}
`);

  const recs = panel('Rekomendowane usprawnienia procedur', `<ul class="checklist">${L.recommendations.map((r) => `<li><span class="ico info">→</span><span>${esc(r)}</span></li>`).join('')}</ul>
    <div class="muted" style="font-size:12.5px;margin-top:12px">Rekomendacje trafiają do właściciela procedury — nie zmieniają automatycznie działania systemu.</div>`);

  return `${pageHead('05 Analityka', 'SIGNAL FEEDBACK', 'Analityka')}
    ${kpi}
    ${histPanel()}
    <div class="grid g-3" style="margin-bottom:24px">${charts}</div>
    <div class="grid g-2">${learning}${recs}</div>`;
}

export function mount(root, ctx) {
  bindChartTips(root);
  loadHist(ctx.refresh);
}
