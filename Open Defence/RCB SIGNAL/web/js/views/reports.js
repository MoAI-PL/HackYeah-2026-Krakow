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
  // Podsumowanie wszystkich raportów: średnie liczone z metryk raportów (bieżący + historyczne).
  const avg = (f) => Math.round(reps.reduce((a, r) => a + f(r.metrics), 0) / reps.length);
  const summary = `<dl class="ov-stats">
    <div class="ov-stat"><dt>Raporty po zdarzeniu</dt><dd>${reps.length}</dd></div>
    <div class="ov-stat"><dt>Średni czas do decyzji</dt><dd>${avg((m) => m.detectionToDecisionMin)} min</dd></div>
    <div class="ov-stat"><dt>Średnia jakość komunikatu</dt><dd>${avg((m) => m.qualityScore)}/100</dd></div>
    <div class="ov-stat"><dt>Wykryte problemy</dt><dd>${reps.reduce((a, r) => a + r.issues.length, 0)}</dd></div>
  </dl>`;
  const latest = reps[0];
  const featured = latest ? `<section class="rep-featured">
      <div>
        <div class="rep-kicker">${latest.live ? 'Najnowszy raport · bieżąca sesja' : 'Najnowszy raport'}</div>
        <h2 class="rep-title">${esc(latest.title)}</h2>
        <div class="muted" style="font-size:14px"><span class="mono">${esc(latest.id)}</span> · ${esc(latest.date)}</div>
        <div class="rep-facts">
          <span><b>${latest.metrics.detectionToDecisionMin} min</b> do decyzji</span>
          <span><b>${latest.metrics.qualityScore}/100</b> jakość komunikatu</span>
          <span><b>${latest.metrics.updates}</b> ${latest.metrics.updates === 1 ? 'aktualizacja' : 'aktualizacje'}</span>
          <span><b>${latest.issues.length}</b> wykryte problemy</span>
        </div>
      </div>
      <button class="btn primary" data-open="${esc(latest.id)}">Otwórz raport →</button>
    </section>` : '';
  const lessons = panel('Wnioski ze wszystkich zdarzeń', `<ol class="numbered">${reps.flatMap((r) => r.recommendations.map((x) => `<li>${esc(x)} <span class="faint mono" style="font-size:12px">${esc(r.id)}</span></li>`)).join('')}</ol>
    <div class="muted" style="font-size:13px;margin-top:12px">Wnioski trafiają do właściciela procedury i do modułu <a href="#/analytics">Analityka</a>.</div>`);
  const issues = panel('Najczęstsze problemy', `<ul class="checklist">${reps.flatMap((r) => r.issues.map((x) => `<li><span class="ico warn">!</span><span>${esc(x)}</span></li>`)).slice(0, 6).join('')}</ul>`);
  return `${pageHead('06 Raporty', 'AFTER ACTION', 'Raporty po zdarzeniach')}
    ${summary}
    ${!s.aarReady ? `<div style="margin-bottom:24px">${callout('info', 'Raport dla EVT-2026-1042 w przygotowaniu', 'Raport zostanie wygenerowany automatycznie po zamknięciu zdarzenia.')}</div>` : featured}
    <div class="grid g-main-side">
    <div class="stack">
    ${panel('Wszystkie raporty', `<div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Zdarzenie</th><th>Data</th><th class="num">Jakość</th><th class="num">Wykrycie → decyzja</th><th>Typ</th></tr></thead>
      <tbody>${reps.map((r) => `<tr class="clickable" data-open="${esc(r.id)}">
        <td class="mono faint">${esc(r.id)}</td><td><b>${esc(r.title)}</b></td><td class="mono">${esc(r.date)}</td>
        <td class="num">${r.metrics.qualityScore}/100</td><td class="num">${r.metrics.detectionToDecisionMin} min</td>
        <td>${r.live ? tag('Bieżąca sesja', 'cyan') : tag('Historyczny')}</td></tr>`).join('')}</tbody>
    </table></div>`, { bodyClass: 'tight' })}
    ${issues}
    </div>
    ${lessons}
    </div>`;
}

// Podsumowanie po zdarzeniu napisane prostym językiem — do publikacji przez samorząd lub na gov.pl po zatwierdzeniu.
function citizenSummary(r) {
  if (r.live) {
    const sent = store.getState().sent;
    const first = sent.find((a) => a.kind === 'initial');
    const upd = sent.find((a) => a.kind === 'update');
    const [y, m, d] = r.date.split('-');
    return [
      `${Number(d)}.${m}.${y} od godz. 17:42 w Nowym Sączu i powiecie nowosądeckim padał intensywny deszcz. Straż pożarna interweniowała przy podtopieniach, zalane były też drogi.`,
      first ? `O ${first.sentAt} RCB wysłało Alert RCB do mieszkańców Nowego Sącza i powiatu nowosądeckiego, ponieważ zagrożenie potwierdziły trzy niezależne służby: IMGW, straż pożarna i Wojewódzkie Centrum Zarządzania Kryzysowego.` : '',
      upd ? `O ${upd.sentAt} alert zaktualizowano: woda zagroziła także powiatowi limanowskiemu, a IMGW przedłużył ostrzeżenie do 23:00.` : '',
      'Informacja o zerwanym moście w Mszanie Dolnej, która krążyła w mediach społecznościowych, nie została potwierdzona przez służby i nie znalazła się w alercie.',
      'Zdarzenie zakończono o 19:15. Przy następnym alercie o podtopieniach: nie wjeżdżaj na zalane drogi i przenieś cenne rzeczy wyżej. W razie zagrożenia życia dzwoń pod 112.',
    ].filter(Boolean).join('\n\n');
  }
  return `${r.date.split('-').reverse().join('.')}: ${r.title}.\n\n${r.timeline.map(([t, who, what]) => `${t} — ${what} (${who})`).join('\n')}`;
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
  return `<a class="back-link no-print" href="#/reports">← Raporty</a>
    ${pageHead(`06 Raporty / ${r.id}`, 'AFTER ACTION', 'Raport po zdarzeniu', '', '<button class="btn sm no-print" data-act="print">Drukuj / PDF</button>')}
    <article class="report">
      <header class="report-head">
        <div>
          <div class="report-org">RCB SIGNAL · ${r.live ? 'raport wygenerowany z dziennika sesji' : 'raport historyczny'}</div>
          <div class="report-title">${esc(r.title)}</div>
          <div class="muted" style="font-size:13px;margin-top:6px"><span class="mono">${esc(r.id)} · ${esc(r.eventId)}</span> · ${esc(r.date)}</div>
        </div>
        
      </header>
      <section class="report-section"><h2>Kluczowe wskaźniki</h2>
        <div class="metric-grid">${metrics.map(([l, v, d]) => `<div class="metric"><div class="stat-label">${l}</div><div class="v">${esc(v)}</div><div class="faint" style="font-size:13px;margin-top:6px">${esc(d)}</div></div>`).join('')}</div>
      </section>
      ${r.live ? `<section class="report-section"><h2>Usprawnienie względem baseline</h2>
        <div class="metric-grid">
          <div class="metric"><div class="stat-label">Jakość komunikatu</div><div class="v">${m.initialScore} → ${m.qualityScore}</div><div class="d">▲ +${m.qualityScore - m.initialScore} pkt</div></div>
          <div class="metric"><div class="stat-label">Zrozumiałość</div><div class="v">+${b.understanding.signal - b.understanding.baseline} p.p.</div><div class="d">vs baseline</div></div>
          <div class="metric"><div class="stat-label">Czas przygotowania</div><div class="v">−${prepGain}%</div><div class="d">vs baseline</div></div>
          <div class="metric"><div class="stat-label">Wykryte niespójności</div><div class="v">${r.issues.length}</div><div class="d">przed lub w trakcie dystrybucji</div></div>
        </div></section>` : ''}
      ${r.delivery ? `<section class="report-section"><h2>Dystrybucja alertu (symulacja)</h2>
        <table class="dlv"><thead><tr><th>Operator</th><th class="num">Dostarczono</th><th class="num">Mediana</th><th class="num">95% odbiorców</th></tr></thead>
        <tbody>${r.delivery.rows.map((o) => `<tr class="${o === r.delivery.slowest && r.delivery.warn ? 'slow' : ''}"><td>${esc(o.name)}</td><td class="num">${pct(o.reach)}</td><td class="num">${store.fmtSec(o.p50)}</td><td class="num">${store.fmtSec(o.p95)}</td></tr>`).join('')}</tbody></table>
        ${r.delivery.warn ? `<p class="muted" style="font-size:13.5px;margin:10px 0 0">${esc(r.delivery.slowest.name)} dostarczał alert wolniej niż pozostali — osoby w tym samym powiecie dostały go w różnym czasie. Do wyjaśnienia z operatorem.</p>` : ''}
      </section>` : ''}
      <div class="report-cols"><section class="report-section"><h2>Przebieg zdarzenia</h2>
        <ul class="timeline">${r.timeline.map(([t, who, what]) => `<li><span class="t">${esc(t)}</span><span class="dot ${who === 'SIGNAL' ? 'cyan' : /^OP-/.test(who) ? 'green' : ''}"></span><span><span class="who">${esc(who)}</span><span class="what">${esc(what)}</span></span></li>`).join('')}</ul>
      </section>
      <div><section class="report-section"><h2>Wykryte problemy</h2>
        <ol class="numbered">${r.issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>
      </section>
      <section class="report-section"><h2>Rekomendacje</h2>
        <ol class="numbered">${r.recommendations.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>
        <div class="muted" style="font-size:12.5px;margin-top:12px">Wnioski trafiają do modułu <a href="#/analytics">Analityka</a>.</div>
      </section></div></div>
      <section class="report-section citizen">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <h2 style="margin:0">Podsumowanie dla mieszkańców</h2>
          <button class="btn sm no-print" data-act="copy">Kopiuj tekst</button>
        </div>
        <div class="citizen-text" id="citizen-text">${esc(citizenSummary(r)).replace(/\n/g, '<br>')}</div>
        <p class="muted" style="font-size:13px;margin:10px 0 0">Projekt do publikacji przez samorząd lub na gov.pl po zatwierdzeniu przez RCB. Wyjaśnia, co się stało i dlaczego wysłano alert — to buduje zaufanie do kolejnych ostrzeżeń.</p>
      </section>
    </article>`;
}

export function render(ctx) {
  return ctx.param ? detail(ctx.param) : list();
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => ctx.navigate(`#/reports/${el.dataset.open}`)));
  root.querySelector('[data-act="print"]')?.addEventListener('click', () => window.print());
  root.querySelector('[data-act="copy"]')?.addEventListener('click', () => {
    const text = root.querySelector('#citizen-text').innerText;
    navigator.clipboard?.writeText(text).then(() => store.toast('Skopiowano podsumowanie dla mieszkańców.', 'ok'), () => store.toast('Nie udało się skopiować — zaznacz tekst ręcznie.', 'warn'));
  });
  if (ctx.param === 'AAR-1042') queueMicrotask(() => store.openAar());
}
