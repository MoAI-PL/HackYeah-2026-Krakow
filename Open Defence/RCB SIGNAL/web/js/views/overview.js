// SCREEN 1 — SIGNAL COMMAND: obraz sytuacji dla dyżurnego.

import * as store from '../store.js';
import { esc, pageHead, panel, tag, PRIORITY, ALERT_STATE } from '../ui.js';

function eventCard(ev) {
  const srcs = store.sourcesFor(ev.id);
  const verified = srcs.filter((s) => s.verification === 'verified').length;
  const facts = [];
  facts.push(tag(`${verified} źr. zweryfikowane`, 'blue'));
  if (ev.situationChanged) facts.push(tag('Sytuacja się zmienia', 'red'));
  if (ev.requiresReview) facts.push(tag('Wymaga weryfikacji', 'amber'));
  if (ev.updateRecommended) facts.push(tag('Rekomendowana aktualizacja', 'amber'));
  const as = ALERT_STATE[ev.alertState];
  facts.push(tag(as.label, as.tag));
  return `<button class="event-card" data-open="${esc(ev.id)}">
    <span class="bar ${esc(ev.priority)}"></span>
    <span class="body">
      <span class="event-id">${esc(ev.id)} · WYKRYTO ${esc(ev.detectedAt)}</span>
      <div class="title">${esc(ev.title)}</div>
      <div class="sub">${esc(ev.region)}</div>
      <div class="facts">${facts.join('')}</div>
    </span>
    <span class="side">
      ${tag(PRIORITY[ev.priority].label, PRIORITY[ev.priority].tag)}
      <span class="mono faint" style="font-size:11px">OTWÓRZ →</span>
    </span>
  </button>`;
}

export function render() {
  const s = store.getState();
  const c = store.counters();
  const evs = store.visibleEvents().map(store.eventView);
  // Zdarzenia priorytetowe = te, dla których SIGNAL prowadzi pełną analizę wieloźródłową.
  const priority = evs.filter((e) => e.status === 'active' && e.analysis)
    .sort((a, b) => ['critical', 'high', 'medium'].indexOf(a.priority) - ['critical', 'high', 'medium'].indexOf(b.priority));
  const other = evs.filter((e) => e.status === 'active' && !priority.includes(e));
  const recent = s.audit.slice(-6).reverse();

  const idle = s.stage === 0 ? `<div class="hero-idle" style="margin-bottom:16px">
      <div>
        <div class="crumbs">Sesja demonstracyjna</div>
        <h3 style="font-size:17px">Scenariusz „Intensywne opady / podtopienia” nie został uruchomiony</h3>
        <div class="muted" style="font-size:13px;max-width:640px">Start ładuje dane syntetyczne z trzech źródeł (IMGW, PSP, WCZK). Każdy kolejny etap uruchamia prezenter — system nie przeskakuje prezentacji automatycznie.</div>
      </div>
      <button class="btn primary" data-action="start-demo">▶ Start demo</button>
    </div>` : '';

  const stats = [
    ['Aktywne zdarzenia', c.active, 's-cyan', 'Województwo demonstracyjne'],
    ['Wymagające weryfikacji', c.review, 's-amber', 'Niepotwierdzone lub zmienne dane'],
    ['Alerty w przygotowaniu', c.preparation, 's-cyan', 'Projekty przed zatwierdzeniem'],
    ['Rekomendowane aktualizacje', c.updates, c.updates > 2 ? 's-red' : 's-amber', 'Alert niezgodny z sytuacją'],
  ];

  return `
    ${pageHead('01 Przegląd', 'SIGNAL COMMAND', 'Obraz sytuacji', 'Jeden obraz sytuacji zamiast zbioru niezależnych komunikatów.')}
    ${idle}
    <div class="grid g-4" style="margin-bottom:16px">
      ${stats.map(([l, v, cls, f]) => `<div class="panel stat ${cls}"><span class="stat-label">${l}</span><span class="stat-value">${v}</span><span class="stat-foot">${f}</span></div>`).join('')}
    </div>
    <div class="grid g-main-side">
      <div class="stack">
        ${panel('Zdarzenia priorytetowe', priority.length ? `<div class="stack" style="gap:10px">${priority.map(eventCard).join('')}</div>` : '<div class="muted">Brak zdarzeń priorytetowych.</div>')}
        ${panel('Pozostałe aktywne zdarzenia', `<div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Zdarzenie</th><th>Obszar</th><th>Alert</th><th>Uwagi</th></tr></thead>
          <tbody>${other.map((e) => `<tr class="clickable" data-open="${esc(e.id)}">
            <td class="mono faint">${esc(e.id)}</td>
            <td><span class="prio ${esc(e.priority)}"></span> ${esc(e.title)}</td>
            <td class="muted">${esc(e.region)}</td>
            <td>${tag(ALERT_STATE[e.alertState].label, ALERT_STATE[e.alertState].tag)}</td>
            <td class="muted" style="font-size:12.5px">${e.requiresReview ? tag('Weryfikacja', 'amber') + ' ' : ''}${e.updateRecommended ? tag('Aktualizacja', 'amber') + ' ' : ''}${esc(e.note || '')}</td>
          </tr>`).join('')}</tbody></table></div>`, { bodyClass: 'tight' })}
      </div>
      <div class="stack">
        ${panel('Cykl ostrzegania', `<ol class="progress-steps">
          ${[['Wykrycie', 1], ['Analiza zdarzenia', 2], ['Projekt i jakość komunikatu', 3], ['Zatwierdzenie (człowiek)', 6], ['Dystrybucja (symulacja)', 7], ['Pomiar i aktualizacja', 8], ['Raport po zdarzeniu', 11]]
            .map(([l, st]) => `<li class="${s.stage > st || (st === 11 && s.stage >= 11) ? 'done' : ''}"><span class="ico">${s.stage > st || (st === 11 && s.stage >= 11) ? '✓' : '·'}</span>${l}</li>`).join('')}
        </ol>`)}
        ${panel('Ostatnie wpisy dziennika', recent.length ? `<ul class="timeline">${recent.map((a) => `<li><span class="t">${esc(a.time)}</span><span class="dot ${a.who === 'SIGNAL' ? 'cyan' : a.who === store.OPERATOR.id ? 'green' : ''}"></span><span><span class="who">${esc(a.who)}</span><span class="what">${esc(a.what)}</span></span></li>`).join('')}</ul>
          <div style="margin-top:10px"><a href="#/audit" class="mono" style="font-size:12px">PEŁNY DZIENNIK AUDYTU →</a></div>` : '<div class="muted">Brak wpisów. Uruchom scenariusz.</div>')}
        ${panel('Zasady systemu', `<ul class="checklist" style="font-size:13px">
          <li><span class="ico info">i</span><span>SIGNAL <b>rekomenduje</b> — decyzję o wysłaniu, zmianie obszaru i odwołaniu podejmuje operator.</span></li>
          <li><span class="ico info">i</span><span>Informacja niezweryfikowana nie jest traktowana jako fakt.</span></li>
          <li><span class="ico info">i</span><span>Każda decyzja: KTO · KIEDY · CO · DLACZEGO · NA PODSTAWIE.</span></li>
          <li><span class="ico info">i</span><span>Dane zagregowane, bez danych osobowych.</span></li>
        </ul>`)}
      </div>
    </div>`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => ctx.navigate(`#/events/${el.dataset.open}`)));
}
