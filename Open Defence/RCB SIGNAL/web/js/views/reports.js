// SCREEN 8 — AFTER ACTION REPORT: raport po zdarzeniu budowany z dziennika audytu.

import * as store from '../store.js';
import { esc, pageHead, panel, tag, callout, pct, syntheticNote } from '../ui.js';

function allReports() {
  const live = store.liveAar();
  return [...(live ? [live] : []), ...store.getData().afterActionReports];
}

function list() {
  const reps = allReports();
  const s = store.getState();
  return `${pageHead('06 Raporty', 'AFTER ACTION', 'Raporty po zdarzeniu', 'Każde zdarzenie kończy się raportem, który pomaga przygotować kolejny alert lepiej.')}
    ${!s.aarReady ? `<div style="margin-bottom:16px">${callout('info', 'Raport dla EVT-2026-1042 w przygotowaniu', 'Raport zostanie wygenerowany automatycznie po zamknięciu zdarzenia.')}</div>` : ''}
    ${panel('Raporty', `<div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Zdarzenie</th><th>Data</th><th class="num">Jakość</th><th class="num">Wykrycie → decyzja</th><th>Typ</th></tr></thead>
      <tbody>${reps.map((r) => `<tr class="clickable" data-open="${esc(r.id)}">
        <td class="mono faint">${esc(r.id)}</td><td><b>${esc(r.title)}</b></td><td class="mono">${esc(r.date)}</td>
        <td class="num">${r.metrics.qualityScore}/100</td><td class="num">${r.metrics.detectionToDecisionMin} min</td>
        <td>${r.live ? tag('Bieżąca sesja', 'cyan') : tag('Historyczny (synt.)')}</td></tr>`).join('')}</tbody>
    </table></div>`, { bodyClass: 'tight' })}`;
}

function detail(id) {
  const r = allReports().find((x) => x.id === id);
  if (!r) return `${pageHead('06 Raporty', 'AFTER ACTION', 'Raport niedostępny')}<div class="empty">Raport ${esc(id)} nie jest jeszcze dostępny — zamknij zdarzenie, aby go wygenerować.<br><a class="btn" href="#/reports">Wróć</a></div>`;
  const m = r.metrics;
  const b = store.getData().benchmarks;
  const prepGain = Math.round((1 - b.preparation.signal / b.preparation.baseline) * 100);
  const metrics = [
    ['Czas do decyzji', `${m.detectionToDecisionMin} min`, 'od wykrycia do zatwierdzenia'],
    ['Przygotowanie alertu', `${m.preparationMin} min`, 'od projektu do zatwierdzenia'],
    ['Jakość komunikatu', `${m.qualityScore}/100`, m.initialScore != null ? `projekt wyjściowy: ${m.initialScore}/100` : ''],
    ['Korelacja źródeł', `${m.sources} źródła`, 'niezależne, zweryfikowane'],
    ['Aktualizacje', `${m.updates}`, m.updates ? 'po zmianie sytuacji' : '—'],
    ...(m.reach ? [['Szacowany zasięg', pct(m.reach), 'symulacja dystrybucji']] : []),
  ];
  return `${pageHead(`06 Raporty / ${r.id}`, 'AFTER ACTION', 'Raport po zdarzeniu', '', '<button class="btn sm no-print" data-act="print">Drukuj / PDF</button> <a class="btn sm ghost no-print" href="#/reports">← Lista</a>')}
    <article class="report">
      <header class="report-head">
        <div>
          <div class="report-org">Rządowe Centrum Bezpieczeństwa · RCB SIGNAL · ${r.live ? 'raport wygenerowany z dziennika sesji' : 'raport historyczny'}</div>
          <div class="report-title">${esc(r.title)}</div>
          <div class="muted mono" style="font-size:12px;margin-top:6px">${esc(r.id)} · ${esc(r.eventId)} · ${esc(r.date)}</div>
        </div>
        <div style="text-align:right">${tag('Jawne — dane syntetyczne', 'amber')}<div class="faint mono" style="font-size:11px;margin-top:8px">DEMO BENCHMARK</div></div>
      </header>
      <section class="report-section"><h2>Kluczowe wskaźniki</h2>
        <div class="metric-grid">${metrics.map(([l, v, d]) => `<div class="metric"><div class="stat-label">${l}</div><div class="v">${esc(v)}</div><div class="faint" style="font-size:11.5px;margin-top:6px">${esc(d)}</div></div>`).join('')}</div>
      </section>
      ${r.live ? `<section class="report-section"><h2>Usprawnienie względem baseline (demo benchmark)</h2>
        <div class="metric-grid">
          <div class="metric"><div class="stat-label">Jakość komunikatu</div><div class="v">${m.initialScore} → ${m.qualityScore}</div><div class="d">▲ +${m.qualityScore - m.initialScore} pkt</div></div>
          <div class="metric"><div class="stat-label">Zrozumiałość</div><div class="v">+${b.understanding.signal - b.understanding.baseline} p.p.</div><div class="d">vs baseline</div></div>
          <div class="metric"><div class="stat-label">Czas przygotowania</div><div class="v">−${prepGain}%</div><div class="d">vs baseline</div></div>
          <div class="metric"><div class="stat-label">Wykryte niespójności</div><div class="v">${r.issues.length}</div><div class="d">przed lub w trakcie dystrybucji</div></div>
        </div>${syntheticNote(b.label)}</section>` : ''}
      <section class="report-section"><h2>Przebieg zdarzenia</h2>
        <ul class="timeline">${r.timeline.map(([t, who, what]) => `<li><span class="t">${esc(t)}</span><span class="dot ${who === 'SIGNAL' ? 'cyan' : /^OP-/.test(who) ? 'green' : ''}"></span><span><span class="who">${esc(who)}</span><span class="what">${esc(what)}</span></span></li>`).join('')}</ul>
      </section>
      <section class="report-section"><h2>Wykryte problemy</h2>
        <ol class="numbered">${r.issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>
      </section>
      <section class="report-section"><h2>Rekomendacje</h2>
        <ol class="numbered">${r.recommendations.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>
        <div class="muted" style="font-size:12.5px;margin-top:12px">Wnioski zasilają moduł SIGNAL FEEDBACK — <a href="#/analytics">analityka i uczenie się systemu →</a></div>
      </section>
    </article>`;
}

export function render(ctx) {
  return ctx.param ? detail(ctx.param) : list();
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => ctx.navigate(`#/reports/${el.dataset.open}`)));
  root.querySelector('[data-act="print"]')?.addEventListener('click', () => window.print());
  if (ctx.param === 'AAR-1042') queueMicrotask(() => store.openAar());
}
