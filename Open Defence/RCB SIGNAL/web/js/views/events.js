// SCREEN 2 / 7 — SIGNAL INTELLIGENCE: zdarzenia, źródła, korelacja i zmiana sytuacji.

import * as store from '../store.js';
import { esc, pageHead, panel, tag, callout, pct, PRIORITY, ALERT_STATE, VERIFICATION, syntheticNote } from '../ui.js';

function list() {
  const evs = store.visibleEvents().map(store.eventView);
  // Jedna flaga na wiersz: zamknięcie albo najważniejsze ostrzeżenie.
  const flag = (e) => e.status === 'closed' ? tag('Zamknięte')
    : e.updateRecommended ? tag('Zalecana aktualizacja', 'amber') : e.requiresReview ? tag('Wymaga weryfikacji', 'amber') : '';
  const row = (e) => `<tr class="clickable" data-open="${esc(e.id)}">
    <td><span class="prio ${esc(e.priority)}" title="${esc(PRIORITY[e.priority].label)}"></span> <b>${esc(e.title)}</b></td>
    <td class="muted">${esc(e.region)}</td>
    <td class="mono">${esc(e.detectedAt)}</td>
    <td class="muted">${esc(ALERT_STATE[e.alertState].label)}</td>
    <td>${flag(e)}</td>
  </tr>`;
  return `${pageHead('02 Zdarzenia', 'SIGNAL INTELLIGENCE', 'Rejestr zdarzeń', 'Zgłoszenia z wielu źródeł połączone we wspólne zdarzenia.')}
    ${panel(`Wszystkie zdarzenia (${evs.length})`, `${priorityLegend()}<div class="table-wrap"><table>
      <thead><tr><th>Zdarzenie</th><th>Obszar</th><th>Wykryto</th><th>Alert</th><th></th></tr></thead>
      <tbody>${evs.map(row).join('')}</tbody></table></div>`, { bodyClass: 'tight' })}`;
}

// Legenda kolorów: kolor kwadratu przy zdarzeniu = priorytet.
export const priorityLegend = () => `<div class="prio-legend"><span class="faint">Priorytet:</span>
  ${['critical', 'high', 'medium', 'low'].map((p) => `<span><span class="prio ${p}"></span> ${PRIORITY[p].label}</span>`).join('')}
</div>`;

function sourceCard(s) {
  const v = VERIFICATION[s.verification];
  const cls = s.verification === 'pending' ? 'unverified' : s.verification === 'quarantined' ? 'quarantined' : '';
  let warning = '';
  if (s.verification === 'pending') warning = `<div style="margin-top:10px">${callout('warn', 'Nie traktować jako faktu', 'Informacja wyłączona z oceny zdarzenia i z treści alertu.')}</div>`;
  if (s.injection) warning = `<div style="margin-top:10px">${callout('error', 'Wykryto polecenie dla systemu (prompt injection)', 'Treść w kwarantannie: traktowana wyłącznie jako dane, nie jako instrukcja. Wymaga weryfikacji przez dyżurnego.')}</div>`;
  return `<article class="source ${cls}">
    <div class="source-head">
      <span class="source-org">${esc(s.source)}</span>
      <span class="faint" style="font-size:13px">${esc(s.unit)}</span>
      <span style="margin-left:auto">${tag(`${v.icon} ${v.label}`, v.tag)}</span>
    </div>
    <div class="source-title">${esc(s.title)}</div>
    <div class="source-body">${esc(s.body)}</div>
    <div class="source-meta">
      <span class="mono">${esc(s.time)}</span><span class="mono">${esc(s.id)}</span>
    </div>
    ${warning}
  </article>`;
}

function detail(id) {
  const raw = store.getData().events.find((e) => e.id === id);
  if (!raw || !store.visibleEvents().includes(raw)) {
    return `<a class="back-link" href="#/events">← Rejestr zdarzeń</a>${pageHead('02 Zdarzenia', 'SIGNAL INTELLIGENCE', 'Nie znaleziono zdarzenia')}<div class="empty">Zdarzenie ${esc(id)} nie jest dostępne w bieżącym etapie scenariusza.<br><a class="btn" href="#/events">Wróć do rejestru</a></div>`;
  }
  const ev = store.eventView(raw);
  const s = store.getState();
  const isMain = ev.id === store.getData().meta.mainEventId;
  const srcs = store.sourcesFor(ev.id);
  const verified = srcs.filter((x) => x.verification === 'verified').length;
  const pending = srcs.length - verified;
  const phase = isMain ? s.phase : 'T0';
  // Reguła weryfikacji zdarzenia: co najmniej 2 niezależne, zweryfikowane źródła uprawnione.
  const independent = new Set(srcs.filter((x) => x.verification === 'verified').map((x) => x.source)).size;
  const eventVerified = independent >= 2;
  const analysis = ev.analysis ? ev.analysis[phase] ?? ev.analysis.T0 : null;
  const sent = s.sent.filter((a) => a.eventId === ev.id);

  // Akcje zależne od etapu scenariusza
  let actions = '';
  let banner = '';
  if (isMain) {
    if (s.stage === 2) actions = '<button class="btn primary" data-act="draft">Przygotuj projekt alertu →</button>';
    if (s.stage >= 3 && s.stage <= 6) actions = '<a class="btn primary" href="#/alerts">Otwórz projekt alertu →</a>';
    if (s.stage === 7) actions = '<button class="btn primary" data-action="advance">Pobierz nowe dane źródłowe (18:30)</button>';
    if (s.stage === 8) {
      const g = store.geoAnalysis(sent[0].areaIds, 'T2');
      banner = `<div style="margin-bottom:24px">${callout('error', 'Sytuacja zmieniona o 18:30', `Aktywny alert ${esc(sent[0].id)} może nie odzwierciedlać bieżącej sytuacji: pokrycie obszaru zagrożenia spadło do <b>${pct(g.coverage)}</b>, IMGW wydłużył ostrzeżenie do <b>23:00</b>, nowe zgłoszenia w <b>pow. limanowskim</b>. <br><b>Rekomendacja SIGNAL:</b> przegląd i aktualizacja alertu (rozszerzenie obszaru, korekta czasu).`)}</div>`;
      actions = '<button class="btn warn" data-act="update">Otwórz proces aktualizacji →</button>';
    }
    if (s.stage === 9) actions = '<a class="btn primary" href="#/alerts">Otwórz aktualizację →</a>';
    if (s.stage === 10) actions = '<button class="btn" data-act="close">Zamknij zdarzenie</button>';
    if (s.stage >= 11) actions = '<a class="btn primary" href="#/reports/AAR-1042">Raport po zdarzeniu (AAR) →</a>';
  }

  const timelineItems = srcs.map((x) => ({ time: x.time, who: x.source, what: x.title, dot: x.verification === 'verified' ? '' : 'amber', isNew: x.phase === 'T2' }));
  if (isMain) {
    timelineItems.push({ time: '17:56', who: 'SIGNAL', what: 'Źródła powiązane we wspólne zdarzenie (3 niezależne)', dot: 'cyan' });
    if (s.phase === 'T2') timelineItems.push({ time: '18:32', who: 'SIGNAL', what: 'Wykryto zmianę sytuacji — rekomendacja aktualizacji alertu', dot: 'red', isNew: true });
    sent.forEach((a) => timelineItems.push({ time: a.sentAt, who: store.OPERATOR.id, what: `${a.kind === 'update' ? 'Aktualizacja' : 'Alert'} ${a.id} zatwierdzony — symulowana dystrybucja`, dot: 'green' }));
    if (s.closed) timelineItems.push({ time: '19:15', who: store.OPERATOR.id, what: 'Zdarzenie zamknięte', dot: 'green' });
  }
  timelineItems.sort((a, b) => a.time.localeCompare(b.time));

  const fact = (label, value, sub, tone = '') => `<div class="ov-stat ${tone}"><dt>${label}</dt><dd>${value}<span class="ov-sub">${sub}</span></dd></div>`;
  const facts = `<dl class="ov-stats facts">
    ${fact('Status', ev.status === 'active' ? 'Aktywne' : 'Zamknięte', `wykryto ${esc(ev.detectedAt)}${ev.closedAt ? `, zamknięto ${esc(ev.closedAt)}` : ''}`, ev.status === 'active' ? 'red' : 'green')}
    ${fact('Weryfikacja', eventVerified ? 'Zweryfikowane' : 'Niezweryfikowane', `źródła uprawnione: ${independent}, wymagane co najmniej 2`, eventVerified ? 'green' : 'amber')}
    ${fact('Źródła', `${verified} zweryfikowane`, pending ? `${pending} oczekujące lub w kwarantannie` : 'wszystkie zweryfikowane')}
    ${fact('Alert RCB', sent.length ? `Aktywny${sent.length > 1 ? ', zaktualizowany' : ''}` : ev.alertState === 'draft' ? 'Projekt' : 'Brak', sent.length ? `wysłano ${esc(sent[sent.length - 1].sentAt)} (symulacja)` : 'wymaga decyzji dyżurnego', sent.length ? 'green' : '')}
  </dl>`;

  const out = store.outageFeed();
  const outageNote = out && isMain ? `<div style="margin-bottom:12px">${callout('warn', `Ocena niepełna — brak danych: ${out.name}`, `Ostatnie dane z tego źródła mogą być nieaktualne. Procedura zastępcza: ${esc(out.fallback)}. Pozostałe źródła i silnik oceny działają dalej.`)}</div>` : '';
  // Uzasadnienie połączenia meldunków — wynik reguł z correlate.js, nie dane wpisane ręcznie.
  // Liczone z meldunków widocznych w bieżącej fazie scenariusza.
  const why = store.correlationFor(ev.id) && srcs.length > 1 ? (() => {
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const areas = [...new Set(srcs.flatMap((x) => x.areaIds))].filter((a) => srcs.filter((x) => x.areaIds.includes(a)).length > 1);
    const times = srcs.map((x) => toMin(x.time));
    return { hazard: store.correlationFor(ev.id).hazard, areas: areas.map((a) => store.areaById(a).properties.label),
      spanMin: Math.max(...times) - Math.min(...times), services: [...new Set(srcs.filter((x) => x.verification === 'verified').map((x) => x.source))] };
  })() : null;
  const whyBox = why ? `<div class="why-box"><div class="callout-title" style="margin-bottom:6px">Dlaczego te meldunki to jedno zdarzenie</div>
    <ul class="checklist">
      <li><span class="ico ok">✓</span><span>Wspólny obszar: <b>${esc(why.areas.join(', ') || '—')}</b></span></li>
      <li><span class="ico ok">✓</span><span>To samo zagrożenie: <b>${esc(why.hazard)}</b></span></li>
      <li><span class="ico ok">✓</span><span>Okno czasowe: <b>${why.spanMin} min</b> (reguła: do 60 min między meldunkami)</span></li>
      <li><span class="ico ${why.services.length >= 2 ? 'ok' : 'warn'}">${why.services.length >= 2 ? '✓' : '!'}</span><span>Niezależne służby: <b>${esc(why.services.join(', '))}</b></span></li>
    </ul></div>` : '';
  const analysisPanel = analysis ? panel('Analiza SIGNAL', `${outageNote}${whyBox}<ul class="checklist">
      ${analysis.positive.map((p) => `<li><span class="ico ok">✓</span><span>${esc(p)}</span></li>`).join('')}
      ${analysis.warnings.map((p) => `<li><span class="ico warn">!</span><span>${esc(p)}</span></li>`).join('')}
    </ul>${syntheticNote('Rekomendacja systemu, decyzję podejmuje dyżurny.')}`) : '';

  const dupC = store.duplicateFor(ev.id);
  const dup = dupC ? '<div class="dup-panel">' + panel('Możliwy duplikat', `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      <div><a href="#/events/${esc(dupC.id)}" class="mono">${esc(dupC.id)}</a> · ${esc(dupC.title)}
      <div class="muted" style="font-size:12.5px;margin-top:4px">${esc(dupC.reason)}</div></div>
      ${s.dupDecision ? tag(s.dupDecision === 'merged' ? 'Połączone' : 'Osobne zdarzenie', 'green') : tag('Do decyzji', 'amber')}
    </div>
    ${s.dupDecision ? '' : `<div class="btn-row" style="margin-top:12px"><button class="btn sm primary" data-dup="merged">Połącz zdarzenia</button><button class="btn sm" data-dup="separate">To osobne zdarzenie</button></div>`}
    <div class="muted" style="font-size:12.5px;margin-top:10px">SIGNAL nie łączy zdarzeń sam — podobny obszar nie oznacza tego samego zagrożenia. Decyzja trafia do dziennika.</div>`) + '</div>' : '';

  const alertsPanel = isMain ? panel('Komunikaty dla zdarzenia', sent.length || s.activeDraftId ? `<div class="stack" style="gap:10px">
      ${Object.values(s.drafts).map((d) => {
        const sentRec = sent.find((a) => a.id === d.id);
        return `<div class="source"><div class="source-head"><span class="source-org">${esc(d.id)}</span><span class="faint" style="font-size:13px">${d.kind === 'update' ? 'aktualizacja' : 'alert pierwotny'}</span><span style="margin-left:auto">${sentRec ? tag('Wysłany (symulacja) ' + sentRec.sentAt, 'green') : tag('Projekt', 'cyan')}</span></div>
          <div style="font-size:14px;margin-top:8px">${esc(d.text)}</div></div>`;
      }).join('')}</div>` : '<div class="muted">Brak komunikatów. Przygotuj projekt alertu.</div>') : '';

  const mapLink = isMain ? panel('Obszar', `<dl class="kv">
      <dt>Obszar zdarzenia</dt><dd>${esc(ev.region)}${s.phase === 'T2' ? ' + pow. limanowski' : ''}</dd>
      <dt>Zgłoszenia</dt><dd>${store.incidentsNow().filter((i) => !i.unverified).length} zweryfikowane</dd>
      ${sent.length ? `<dt>Pokrycie alertu</dt><dd>${pct(store.geoAnalysis(sent[sent.length - 1].areaIds).coverage)}</dd>` : ''}
    </dl><div style="margin-top:12px"><a class="btn sm" href="#/map">Pokaż na mapie →</a></div>`) : '';

  const minor = !ev.analysis ? panel('Informacje', `<dl class="kv"><dt>Kategoria</dt><dd>${esc(ev.category)}</dd><dt>Obszar</dt><dd>${esc(ev.region)}</dd><dt>Uwagi</dt><dd>${esc(ev.note || '—')}</dd></dl>`) : '';

  return `<a class="back-link" href="#/events">← Rejestr zdarzeń</a>
    ${pageHead(`02 Zdarzenia / ${ev.id}`, 'SIGNAL INTELLIGENCE', ev.title, `${esc(ev.region)} · <span class="mono">${esc(ev.id)}</span>`, actions)}
    ${banner}
    ${facts}
    <div class="grid g-main-side">
      <div class="stack">
        ${srcs.length ? panel('Oś czasu', `<ul class="timeline">${timelineItems.map((t) => `<li class="${t.isNew ? 'new' : ''}"><span class="t">${esc(t.time)}</span><span class="dot ${t.dot}"></span><span><span class="who">${esc(t.who)}</span><span class="what">${esc(t.what)}</span></span></li>`).join('')}</ul>`) : ''}
        ${srcs.length ? panel(`Źródła informacji (${srcs.length})`, srcs.map(sourceCard).join('')) : minor}
      </div>
      <div class="stack">
        ${analysisPanel}
        ${alertsPanel}
        ${mapLink}
        ${dup}
      </div>
    </div>`;
}

export function render(ctx) {
  return ctx.param ? detail(ctx.param) : list();
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => ctx.navigate(`#/events/${el.dataset.open}`)));
  if (ctx.param) queueMicrotask(() => store.openEvent(ctx.param));
  root.querySelectorAll('[data-dup]').forEach((el) => el.addEventListener('click', () => store.resolveDuplicate(el.dataset.dup)));
  root.querySelector('[data-act="draft"]')?.addEventListener('click', () => { store.createDraft(); ctx.navigate('#/alerts'); });
  root.querySelector('[data-act="update"]')?.addEventListener('click', () => { store.openUpdateWorkflow(); ctx.navigate('#/alerts'); });
  root.querySelector('[data-act="close"]')?.addEventListener('click', () => {
    if (confirm('Zamknąć zdarzenie EVT-2026-1042? Decyzja zostanie zapisana w dzienniku audytu.')) {
      store.closeEvent();
      store.toast('Zdarzenie zamknięte. SIGNAL wygenerował raport po zdarzeniu (AAR-1042).', 'ok');
    }
  });
}
