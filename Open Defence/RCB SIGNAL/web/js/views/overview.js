// SCREEN 1 — SIGNAL COMMAND: obraz sytuacji dla dyżurnego.
// Wersja gov-tech: jedna informacja na element, mniej znaczników, czytelna hierarchia.

import * as store from '../store.js';
import { esc, pageHead, PRIORITY, ALERT_STATE } from '../ui.js';

const PRIO_ORDER = ['critical', 'high', 'medium', 'low'];

// Jedno, najważniejsze ostrzeżenie dla zdarzenia (zamiast kilku znaczników naraz).
function warning(ev) {
  if (ev.situationChanged) return ['Sytuacja się zmienia', 'red'];
  if (ev.updateRecommended) return ['Zalecana aktualizacja alertu', 'amber'];
  if (ev.requiresReview) return ['Wymaga weryfikacji', 'amber'];
  return null;
}

function eventRow(ev) {
  const w = warning(ev);
  return `<button class="ov-event" data-open="${esc(ev.id)}">
    <span class="ov-prio ${esc(ev.priority)}">${esc(PRIORITY[ev.priority].label)}</span>
    <span class="ov-event-main">
      <span class="ov-event-title">${esc(ev.title)}</span>
      <span class="ov-event-meta">${esc(ev.region)} · wykryto ${esc(ev.detectedAt)} · ${esc(ALERT_STATE[ev.alertState].label.toLowerCase())}</span>
    </span>
    ${w ? `<span class="ov-flag ${w[1]}">${esc(w[0])}</span>` : '<span></span>'}
    <span class="ov-chev" aria-hidden="true">›</span>
  </button>`;
}

export function render() {
  const s = store.getState();
  const c = store.counters();
  const evs = store.visibleEvents().map(store.eventView).filter((e) => e.status === 'active');
  // Zdarzenia priorytetowe = te, dla których SIGNAL prowadzi pełną analizę wieloźródłową.
  const priority = evs.filter((e) => e.analysis)
    .sort((a, b) => PRIO_ORDER.indexOf(a.priority) - PRIO_ORDER.indexOf(b.priority));
  const other = evs.filter((e) => !priority.includes(e));
  const recent = s.audit.slice(-4).reverse();

  const idle = s.stage === 0 ? `<div class="ov-start">
      <div>
        <h2 class="ov-h2">Scenariusz nie jest uruchomiony</h2>
        <p>Start ładuje dane syntetyczne z trzech źródeł: IMGW, PSP i WCZK.</p>
      </div>
      <button class="btn primary" data-action="start-demo">▶ Start demo</button>
    </div>` : '';

  const stats = [
    ['Aktywne zdarzenia', c.active, ''],
    ['Do weryfikacji', c.review, c.review ? 'amber' : ''],
    ['Alerty w przygotowaniu', c.preparation, ''],
    ['Zalecane aktualizacje', c.updates, c.updates ? 'red' : ''],
  ];

  return `
    ${pageHead('01 Przegląd', 'SIGNAL COMMAND', 'Przegląd sytuacji')}
    <div class="ov">
      ${idle}
      <dl class="ov-stats">
        ${stats.map(([l, v, tone]) => `<div class="ov-stat ${tone}"><dt>${l}</dt><dd>${v}</dd></div>`).join('')}
      </dl>
      <div class="ov-grid">
        <div>
          <section class="ov-section">
            <h2 class="ov-h2">Zdarzenia priorytetowe <span class="ov-count">${priority.length}</span></h2>
            ${priority.length ? `<div class="ov-list">${priority.map(eventRow).join('')}</div>` : '<p class="muted">Brak zdarzeń priorytetowych.</p>'}
          </section>
          ${other.length ? `<section class="ov-section">
            <h2 class="ov-h2">Pozostałe zdarzenia <span class="ov-count">${other.length}</span></h2>
            <table class="ov-table">
              <thead><tr><th>Zdarzenie</th><th>Obszar</th><th>Alert</th></tr></thead>
              <tbody>${other.map((e) => `<tr class="clickable" data-open="${esc(e.id)}">
                <td><span class="prio ${esc(e.priority)}"></span> ${esc(e.title)}</td>
                <td class="muted">${esc(e.region)}</td>
                <td class="muted">${esc(ALERT_STATE[e.alertState].label)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </section>` : ''}
        </div>
        <aside>
          <section class="ov-section">
            <h2 class="ov-h2">Ostatnie działania</h2>
            ${recent.length ? `<ul class="ov-log">${recent.map((a) => `<li><span class="mono">${esc(a.time)}</span><span><b>${esc(a.who)}</b> ${esc(a.what)}</span></li>`).join('')}</ul>
              <a href="#/audit" class="ov-link">Pełny dziennik audytu</a>` : '<p class="muted">Brak wpisów. Uruchom scenariusz.</p>'}
          </section>
          <section class="ov-section">
            <h2 class="ov-h2">Stan źródeł danych</h2>
            <ul class="feeds">${store.sourceHealth().map((f) => `<li class="${f.down ? 'down' : ''}">
              <span class="feed-dot"></span>
              <span><b>${esc(f.name)}</b><span class="muted"> · ${esc(f.desc)}</span><br>
                <span class="feed-state">${f.down ? `Brak odpowiedzi${f.ago != null ? ` od ${f.ago} min` : ''} · ostatnie dane ${esc(f.lastAt)}` : f.lastAt === '—' ? 'Gotowe, raporty po wysyłce' : `Działa · ostatnie dane ${esc(f.lastAt)}`}</span></span>
              <button class="btn sm ghost" data-outage="${f.down ? '' : esc(f.id)}">${f.down ? 'Przywróć' : 'Symuluj awarię'}</button>
            </li>`).join('')}</ul>
            <p class="faint" style="font-size:13px;margin:10px 0 0">Ocena działa lokalnie, bez usług zewnętrznych. Gdy źródło milknie, SIGNAL oznacza ocenę jako niepełną i podaje procedurę zastępczą.</p>
          </section>
        </aside>
      </div>
    </div>`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-outage]').forEach((el) => el.addEventListener('click', () => store.setOutage(el.dataset.outage || null)));
  root.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => ctx.navigate(`#/events/${el.dataset.open}`)));
}
