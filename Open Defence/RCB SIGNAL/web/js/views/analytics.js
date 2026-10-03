// SCREEN 9–10 — SIGNAL FEEDBACK: mierzalność i uczenie się systemu.

import * as store from '../store.js';
import { esc, pageHead, panel, tag, compareChart, bindChartTips, syntheticNote } from '../ui.js';

export function render() {
  const b = store.getData().benchmarks;
  const charts = [
    ['Jakość komunikatu', 'Actionability score (0–100)', b.quality, 'higher'],
    ['Czas przygotowania', 'Od otwarcia zdarzenia do zatwierdzenia', b.preparation, 'lower'],
    ['Zrozumienie instrukcji', 'Odsetek poprawnych odpowiedzi w teście zrozumiałości', b.understanding, 'higher'],
  ].map(([title, sub, m, better]) => panel(title, `<div class="muted" style="font-size:12.5px;margin-bottom:10px">${sub}</div>
    ${compareChart({ title, unit: m.unit, max: m.max, better, rows: [{ label: 'BASELINE', value: m.baseline }, { label: 'RCB SIGNAL', value: m.signal, highlight: true }] })}
    ${syntheticNote(b.label)}`)).join('');

  const kpi = panel('KPI pilotażu', `<div class="table-wrap"><table>
    <thead><tr><th>Wskaźnik</th><th class="num">Cel pilotażu</th><th class="num">Wynik demo</th></tr></thead>
    <tbody>${b.kpi.map(([k, target, val]) => `<tr><td>${esc(k)}</td><td class="num">${esc(target)}</td><td class="num">${val === 'nie badano' ? `<span class="faint">${esc(val)}</span>` : esc(val)}</td></tr>`).join('')}</tbody>
  </table></div><div style="padding:0 14px 14px">${syntheticNote('Wartości są celami i wynikami demonstracyjnymi — nie wynikami wdrożenia')}</div>`, { bodyClass: 'tight' });

  const L = b.learning;
  const max = Math.max(...L.issues.map((i) => i[1]));
  const learning = panel('Uczenie się systemu', `<div class="muted" style="font-size:13px;margin-bottom:10px">Najczęstsze problemy wykryte w <b class="mono">${L.events}</b> symulowanych zdarzeniach (odsetek projektów alertów):</div>
    ${L.issues.map(([l, v], i) => `<div class="hbar" data-tip="${esc(`${l}: ${v}% projektów`)}"><span>${i + 1}. ${esc(l)}</span><span class="track"><i style="width:${(v / max) * 100}%"></i></span><span class="mono num">${v}%</span></div>`).join('')}
    ${syntheticNote(b.label)}`);

  const recs = panel('Rekomendowane usprawnienia procedur', `<ul class="checklist">${L.recommendations.map((r) => `<li><span class="ico info">→</span><span>${esc(r)}</span></li>`).join('')}</ul>
    <div class="muted" style="font-size:12.5px;margin-top:12px">Rekomendacje trafiają do właściciela procedury — nie zmieniają automatycznie działania systemu.</div>`);

  const method = panel('Jak mierzymy', `<ul class="checklist" style="font-size:13px">
    <li><span class="ico info">1</span><span><b>Test historyczny</b> — istniejące komunikaty vs wersje przygotowane z SIGNAL.</span></li>
    <li><span class="ico info">2</span><span><b>Test zrozumiałości</b> — co się dzieje? gdzie? kiedy? co mam zrobić?</span></li>
    <li><span class="ico info">3</span><span><b>Symulacja operatora</b> — baseline vs SIGNAL: czas, błędy, kompletność, liczba korekt.</span></li>
    <li><span class="ico info">4</span><span><b>After action</b> — raport po zdarzeniu z listą usprawnień.</span></li>
  </ul>`);

  return `${pageHead('05 Analityka', 'SIGNAL FEEDBACK', 'Mierzalność ostrzegania', 'Nie twierdzimy, że system „zwiększa zaufanie” — pokazujemy, jak to zmierzyć.', tag('Demo benchmark', 'amber'))}
    <div class="grid g-3" style="margin-bottom:16px">${charts}</div>
    <div class="grid g-2" style="margin-bottom:16px">${learning}${recs}</div>
    <div class="grid g-2">${kpi}${method}</div>`;
}

export function mount(root) {
  bindChartTips(root);
}
