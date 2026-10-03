// SCREEN 2 / 7 — SIGNAL INTELLIGENCE: zdarzenia, źródła, korelacja i zmiana sytuacji.

import * as store from '../store.js';
import { esc, pageHead, panel, tag, callout, pct, PRIORITY, ALERT_STATE, VERIFICATION, syntheticNote } from '../ui.js';

function list() {
  const evs = store.visibleEvents().map(store.eventView);
  const row = (e) => `<tr class="clickable" data-open="${esc(e.id)}">
    <td class="mono faint">${esc(e.id)}</td>
    <td><span class="prio ${esc(e.priority)}"></span> <b>${esc(e.title)}</b></td>
    <td class="muted">${esc(e.region)}</td>
    <td class="mono">${esc(e.detectedAt)}</td>
    <td>${tag(PRIORITY[e.priority].label, PRIORITY[e.priority].tag)}</td>
    <td>${e.status === 'closed' ? tag('Zamknięte') : tag('Aktywne', 'cyan')}</td>
    <td>${tag(ALERT_STATE[e.alertState].label, ALERT_STATE[e.alertState].tag)}</td>
    <td>${e.requiresReview ? tag('Weryfikacja', 'amber') : ''} ${e.updateRecommended ? tag('Aktualizacja', 'amber') : ''}</td>
  </tr>`;
  return `${pageHead('02 Zdarzenia', 'SIGNAL INTELLIGENCE', 'Rejestr zdarzeń', 'Zgłoszenia z wielu źródeł grupowane we wspólne zdarzenia.')}
    ${panel(`Zdarzenia (${evs.length})`, `<div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Zdarzenie</th><th>Obszar</th><th>Wykryto</th><th>Priorytet</th><th>Status</th><th>Alert</th><th>Flagi</th></tr></thead>
      <tbody>${evs.map(row).join('')}</tbody></table></div>`, { bodyClass: 'tight' })}`;
}

function sourceCard(s) {
  const v = VERIFICATION[s.verification];
  const cls = s.verification === 'pending' ? 'unverified' : s.verification === 'quarantined' ? 'quarantined' : '';
  let warning = '';
  if (s.verification === 'pending') warning = `<div style="margin-top:10px">${callout('warn', 'Źródło niezweryfikowane', 'Nie wykorzystywać jako potwierdzonego faktu. Informacja wyłączona z oceny zdarzenia i z treści alertu.')}</div>`;
  if (s.injection) warning = `<div style="margin-top:10px">${callout('error', 'Wykryto treść sterującą (prompt injection)', 'Zgłoszenie zawiera polecenie skierowane do systemu. Treść poddana kwarantannie — traktowana wyłącznie jako dane, nie jako instrukcja. Wymagana weryfikacja przez dyżurnego.')}</div>`;
  return `<article class="source ${cls}">
    <div class="source-head">
      <span class="source-org">${esc(s.source)}</span>
      <span class="faint mono" style="font-size:11px">${esc(s.unit)}</span>
      <span style="margin-left:auto">${tag(`${v.icon} ${v.label}`, v.tag)}</span>
    </div>
    <div class="source-title">${esc(s.title)}</div>
    <div class="source-body">${esc(s.body)}</div>
    <div class="source-meta">
      <span>ID ${esc(s.id)}</span><span>CZAS ${esc(s.time)}</span>
      <span>${s.verification === 'verified' ? 'POTWIERDZONE PRZEZ SŁUŻBĘ UPRAWNIONĄ' : 'BRAK POTWIERDZENIA PRZEZ SŁUŻBY'}</span>
    </div>
    ${warning}
  </article>`;
}

function detail(id) {
  const raw = store.getData().events.find((e) => e.id === id);
  if (!raw || !store.visibleEvents().includes(raw)) {
    return `${pageHead('02 Zdarzenia', 'SIGNAL INTELLIGENCE', 'Nie znaleziono zdarzenia')}<div class="empty">Zdarzenie ${esc(id)} nie jest dostępne w bieżącym etapie scenariusza.<br><a class="btn" href="#/events">Wróć do rejestru</a></div>`;
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
    if (s.stage === 8) {
      const g = store.geoAnalysis(sent[0].areaIds, 'T2');
      banner = `<div style="margin-bottom:16px">${callout('error', 'Sytuacja zmieniona — 18:30', `Aktywny alert ${esc(sent[0].id)} może nie odzwierciedlać bieżącej sytuacji: pokrycie obszaru zagrożenia spadło do <b>${pct(g.coverage)}</b>, IMGW wydłużył ostrzeżenie do <b>23:00</b>, nowe zgłoszenia w <b>pow. lipnickim</b>. <br><b>REKOMENDACJA SIGNAL:</b> przegląd i aktualizacja alertu (rozszerzenie obszaru, korekta czasu).`)}</div>`;
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

  const facts = `<div class="grid g-4" style="margin-bottom:16px">
    <div class="panel stat ${ev.status === 'active' ? 's-red' : 's-green'}"><span class="stat-label">Status</span><span class="stat-value" style="font-size:20px">${ev.status === 'active' ? '<span class="pulse" style="color:var(--red)">●</span> AKTYWNE' : '✓ ZAMKNIĘTE'}</span><span class="stat-foot">Wykryto ${esc(ev.detectedAt)}${ev.closedAt ? ` · zamknięto ${esc(ev.closedAt)}` : ''}</span></div>
    <div class="panel stat ${eventVerified ? 's-green' : 's-amber'}"><span class="stat-label">Weryfikacja zdarzenia</span><span class="stat-value" style="font-size:20px">${eventVerified ? '✓ ZWERYFIKOWANE' : '! NIEZWERYFIKOWANE'}</span><span class="stat-foot">${independent} niezależne źródła uprawnione · wymagane ≥ 2</span></div>
    <div class="panel stat s-cyan"><span class="stat-label">Źródła</span><span class="stat-value">${verified}<span style="font-size:16px;color:var(--muted)"> zweryf.</span></span><span class="stat-foot">${pending ? `${pending} oczekujące / kwarantanna` : 'Wszystkie zweryfikowane'}</span></div>
    <div class="panel stat ${sent.length ? 's-green' : 's-amber'}"><span class="stat-label">Alert RCB</span><span class="stat-value" style="font-size:20px">${sent.length ? `AKTYWNY${sent.length > 1 ? ` · ${sent.length - 1} AKT.` : ''}` : ev.alertState === 'draft' ? 'PROJEKT' : 'BRAK'}</span><span class="stat-foot">${sent.length ? `Ostatnia wysyłka ${esc(sent[sent.length - 1].sentAt)} (symulacja)` : 'Decyzja operatora wymagana'}</span></div>
  </div>`;

  const analysisPanel = analysis ? panel('Analiza SIGNAL', `<ul class="checklist">
      ${analysis.positive.map((p) => `<li><span class="ico ok">✓</span><span>${esc(p)}</span></li>`).join('')}
      ${analysis.warnings.map((p) => `<li><span class="ico warn">!</span><span>${esc(p)}</span></li>`).join('')}
    </ul>${syntheticNote('Rekomendacja systemu — decyzję podejmuje operator')}`) : '';

  const dup = ev.duplicateCandidate ? panel('Możliwy duplikat', `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      <div><a href="#/events/${esc(ev.duplicateCandidate.id)}" class="mono">${esc(ev.duplicateCandidate.id)}</a> · Wysoki stan wody — rzeka Nadra
      <div class="muted" style="font-size:12.5px;margin-top:4px">${esc(ev.duplicateCandidate.reason)}</div></div>
      ${tag('Do weryfikacji', 'amber')}
    </div><div class="muted" style="font-size:12px;margin-top:10px">Połączenie zdarzeń wymaga decyzji operatora.</div>`) : '';

  const alertsPanel = isMain ? panel('Komunikaty dla zdarzenia', sent.length || s.activeDraftId ? `<div class="stack" style="gap:10px">
      ${Object.values(s.drafts).map((d) => {
        const sentRec = sent.find((a) => a.id === d.id);
        return `<div class="source"><div class="source-head"><span class="source-org">${esc(d.id)}</span><span class="faint mono" style="font-size:11px">${d.kind === 'update' ? 'AKTUALIZACJA' : 'ALERT PIERWOTNY'}</span><span style="margin-left:auto">${sentRec ? tag('Wysłany (symulacja) ' + sentRec.sentAt, 'green') : tag('Projekt', 'cyan')}</span></div>
          <div class="mono" style="font-size:13px;margin-top:8px">${esc(d.text)}</div></div>`;
      }).join('')}</div>` : '<div class="muted">Brak komunikatów. Przygotuj projekt alertu.</div>') : '';

  const mapLink = isMain ? panel('Obszar', `<dl class="kv">
      <dt>Obszar zdarzenia</dt><dd>${esc(ev.region)}${s.phase === 'T2' ? ' + pow. lipnicki' : ''}</dd>
      <dt>Zgłoszenia</dt><dd>${store.incidentsNow().filter((i) => !i.unverified).length} zweryfikowane</dd>
      ${sent.length ? `<dt>Pokrycie alertu</dt><dd>${pct(store.geoAnalysis(sent[sent.length - 1].areaIds).coverage)}</dd>` : ''}
    </dl><div style="margin-top:12px"><a class="btn sm" href="#/map">Analiza obszaru — SIGNAL GEO →</a></div>`) : '';

  const minor = !ev.analysis ? panel('Informacje', `<dl class="kv"><dt>Kategoria</dt><dd>${esc(ev.category)}</dd><dt>Obszar</dt><dd>${esc(ev.region)}</dd><dt>Uwagi</dt><dd>${esc(ev.note || '—')}</dd></dl>`) : '';

  return `${pageHead(`02 Zdarzenia / ${ev.id}`, 'SIGNAL INTELLIGENCE', ev.title.toUpperCase(), `${esc(ev.id)} · ${esc(ev.region)}`, actions)}
    ${banner}
    ${facts}
    <div class="grid g-main-side">
      <div class="stack">
        ${srcs.length ? panel('Oś czasu', `<ul class="timeline">${timelineItems.map((t) => `<li class="${t.isNew ? 'new' : ''}"><span class="t">${esc(t.time)}</span><span class="dot ${t.dot}"></span><span><span class="who">${esc(t.who)}</span><span class="what">${esc(t.what)}</span></span></li>`).join('')}</ul>`) : ''}
        ${srcs.length ? panel(`Źródła informacji (${srcs.length})`, srcs.map(sourceCard).join('') + syntheticNote()) : minor}
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
  root.querySelector('[data-act="draft"]')?.addEventListener('click', () => { store.createDraft(); ctx.navigate('#/alerts'); });
  root.querySelector('[data-act="update"]')?.addEventListener('click', () => { store.openUpdateWorkflow(); ctx.navigate('#/alerts'); });
  root.querySelector('[data-act="close"]')?.addEventListener('click', () => {
    if (confirm('Zamknąć zdarzenie EVT-2026-1042? Decyzja zostanie zapisana w dzienniku audytu.')) {
      store.closeEvent();
      store.toast('Zdarzenie zamknięte. SIGNAL wygenerował raport po zdarzeniu (AAR-1042).', 'ok');
    }
  });
}
