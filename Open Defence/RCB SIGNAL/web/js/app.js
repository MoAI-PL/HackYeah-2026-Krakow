// RCB SIGNAL — powłoka aplikacji, routing i pasek prezentera.

import * as store from './store.js';
import { loadDataset, providerStatus } from './services.js';
import { esc } from './ui.js';
import * as overview from './views/overview.js';
import * as events from './views/events.js';
import * as map from './views/map.js';
import * as alerts from './views/alerts.js';
import * as analytics from './views/analytics.js';
import * as reports from './views/reports.js';
import * as audit from './views/audit.js';

const NAV = [
  { code: '01', path: 'overview', title: 'Przegląd', module: 'SIGNAL COMMAND', view: overview },
  { code: '02', path: 'events', title: 'Zdarzenia', module: 'SIGNAL INTELLIGENCE', view: events },
  { code: '03', path: 'map', title: 'Mapa', module: 'SIGNAL GEO', view: map },
  { code: '04', path: 'alerts', title: 'Alerty', module: 'SIGNAL WRITER', view: alerts },
  { code: '05', path: 'analytics', title: 'Analityka', module: 'SIGNAL FEEDBACK', view: analytics },
  { code: '06', path: 'reports', title: 'Raporty', module: 'AFTER ACTION', view: reports },
  { code: '07', path: 'audit', title: 'Dziennik audytu', module: 'AUDIT LOG', view: audit },
];

const STAGE_ROUTE = {
  1: '#/events/EVT-2026-1042', 2: '#/events/EVT-2026-1042', 3: '#/alerts', 4: '#/alerts', 5: '#/alerts', 6: '#/alerts',
  8: '#/events/EVT-2026-1042', 9: '#/alerts', 10: '#/events/EVT-2026-1042', 11: '#/reports/AAR-1042',
};

let presenterCollapsed = false;
let llm = { llm: false };

function route() {
  const [path = 'overview', param] = location.hash.replace(/^#\/?/, '').split('/');
  const entry = NAV.find((n) => n.path === path) || NAV[0];
  return { entry, param: param ? decodeURIComponent(param) : null };
}

function navBadge(path) {
  const c = store.counters();
  const s = store.getState();
  if (path === 'events' && c.review) return c.review;
  if (path === 'alerts' && store.activeDraft() && store.activeDraft().status !== 'sent') return 1;
  if (path === 'reports' && s.aarReady && s.stage === 11) return 'NOWY';
  return '';
}

function renderShell() {
  const s = store.getState();
  const d = store.getData();
  const { entry } = route();
  const dateStr = d.meta.scenarioDate.split('-').reverse().join('.');
  document.getElementById('app').innerHTML = `
    <div class="classification" role="note">
      <span>Środowisko demonstracyjne</span><span class="sep">—</span><span>dane syntetyczne</span>
      <span class="sep opt">·</span><span class="opt">brak połączenia z systemami produkcyjnymi</span>
    </div>
    <header class="topbar">
      <div class="brand">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <rect x="1" y="1" width="32" height="32" rx="3" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
          <path d="M8 22 L13 14 L17 19 L21 10 L26 22" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
          <line x1="8" y1="26" x2="26" y2="26" stroke="var(--muted)" stroke-width="1.5"/>
        </svg>
        <div>
          <div class="brand-name">RCB SIGNAL</div>
          <div class="brand-sub">System wspomagania decyzji · ostrzeganie ludności</div>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="top-meta">
        <div class="meta-item keep"><span class="meta-label">Czas scenariusza</span><span class="meta-value clock-value">${dateStr} · ${esc(s.clock)}</span></div>
        <div class="meta-item"><span class="meta-label">Status systemu</span><span class="meta-value"><span class="status-dot"></span>OPERACYJNY</span></div>
        <div class="meta-item opt"><span class="meta-label">Silnik analizy</span><span class="meta-value">${llm.llm ? 'REGUŁY + LLM (DORADCZO)' : 'REGUŁOWY · DETERMINISTYCZNY'}</span></div>
        <div class="meta-item opt"><span class="meta-label">Operator</span><span class="meta-value">${store.OPERATOR.id} · ${store.OPERATOR.role.toUpperCase()}</span></div>
      </div>
    </header>
    <div class="shell">
      <nav class="sidebar" aria-label="Moduły systemu">
        <div class="nav-caption">Moduły</div>
        <div class="nav-group">
          ${NAV.map((n) => {
            const badge = navBadge(n.path);
            return `<a class="nav-link ${n === entry ? 'active' : ''}" href="#/${n.path}" ${n === entry ? 'aria-current="page"' : ''}>
              <span class="nav-code">${n.code}</span>
              <span><span class="nav-title">${esc(n.title)}</span><span class="nav-module">${esc(n.module)}</span></span>
              ${badge ? `<span class="nav-badge">${esc(badge)}</span>` : '<span></span>'}
            </a>`;
          }).join('')}
        </div>
        <div class="sidebar-foot">
          <strong>Zasada:</strong> SIGNAL rekomenduje.<br>Człowiek decyduje.<br>
          <span class="mono">Wysyłka: wyłącznie symulowana</span>
        </div>
      </nav>
      <main class="main" id="view" tabindex="-1"></main>
    </div>
    ${renderPresenter()}
  `;
}

function renderPresenter() {
  const s = store.getState();
  const st = store.STAGES[s.stage];
  const total = store.STAGES.length - 1;
  const go = STAGE_ROUTE[s.stage];
  return `<div class="presenter ${presenterCollapsed ? 'collapsed' : ''}" role="region" aria-label="Sterowanie scenariuszem">
    <span class="p-label">TRYB DEMO</span>
    <span class="p-step">KROK ${s.stage}/${total} · ${esc(st.label.toUpperCase())}</span>
    <span class="p-progress" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < s.stage ? 'on' : ''}"></i>`).join('')}</span>
    <span class="p-hint">${esc(st.hint)}</span>
    ${go ? `<a class="btn sm ghost" href="${go}">Przejdź →</a>` : ''}
    ${s.stage === 0
      ? '<button class="btn sm primary" data-action="start-demo">▶ Start demo</button>'
      : `<button class="btn sm ${s.stage === 7 ? 'warn' : ''}" data-action="advance" ${s.stage === 7 ? '' : 'disabled'} title="Wprowadza nowe dane źródłowe (18:30)">Następny etap scenariusza ⏭</button>`}
    <button class="btn sm ghost" data-action="reset-demo">Reset demo</button>
  </div>`;
}

function renderView() {
  const { entry, param } = route();
  const root = document.getElementById('view');
  const ctx = { param, navigate: (h) => { location.hash = h; }, refresh: render };
  root.innerHTML = entry.view.render(ctx);
  entry.view.mount?.(root, ctx);
}

function render() {
  const main = document.getElementById('view');
  const scroll = main ? window.scrollY : 0;
  renderShell();
  renderView();
  window.scrollTo(0, scroll);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const a = btn.dataset.action;
  if (a === 'start-demo') { store.startDemo(); location.hash = '#/overview'; }
  if (a === 'reset-demo') {
    if (store.getState().stage === 0 || confirm('Zresetować scenariusz demonstracyjny do stanu początkowego?')) {
      store.resetDemo();
      location.hash = '#/overview';
    }
  }
  if (a === 'advance') { store.advanceScenario(); location.hash = '#/events/EVT-2026-1042'; }
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key.toLowerCase() === 'p') { presenterCollapsed = !presenterCollapsed; render(); }
});

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

function showToast(t) {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${t.tone}`;
  el.textContent = t.message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function boot() {
  try {
    const dataset = await loadDataset();
    store.init(dataset);
    store.subscribe(render);
    store.onToast(showToast);
    render();
    llm = await providerStatus();
    if (llm.llm) render();
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty"><h1>Błąd uruchomienia</h1><p>${esc(err.message)}</p>
      <p class="muted">Uruchom aplikację poleceniem <code>python3 server.py</code> i otwórz http://localhost:8080</p></div>`;
  }
}

boot();
