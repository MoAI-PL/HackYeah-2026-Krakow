// SCREEN 3 — SIGNAL GEO: obszar zagrożenia vs obszar alertu vs zgłoszenia.
// Mapa powiatów woj. małopolskiego z rzeczywistymi granicami (PRG/GUGiK, wstępnie zrzutowane do SVG — działa offline).
// Zdarzenia, zgłoszenia i populacja są fikcyjne.

import * as store from '../store.js';
import { esc, pageHead, panel, tag, callout, pct } from '../ui.js';

let selected = 'P02';
const layers = { hazard: true, alert: true, incidents: true, river: true };

const pts = (ring) => ring.map((p) => p.join(',')).join(' ');

// Mapa poglądowa Polski (wszystkie powiaty) — ładowana raz, przy pierwszym wejściu na ekran mapy.
let poland = null;
let polandLoading = false;
function loadPoland(refresh) {
  if (poland || polandLoading) return;
  polandLoading = true;
  fetch('data/poland-powiaty.json').then((r) => r.json()).then((j) => { poland = j; refresh(); }).catch(() => { polandLoading = false; });
}

function polandSvg() {
  if (!poland) return '<div class="faint" style="font-size:13px">Ładowanie mapy…</div>';
  return `<svg class="pl-map" viewBox="${poland.viewBox}" role="img" aria-label="Mapa powiatów Polski z zaznaczonym obszarem scenariusza">
    ${poland.features.map((f) => `<path class="${f.r ? 'in' : ''}" d="${f.d}"><title>${esc(f.n)}</title></path>`).join('')}
  </svg>`;
}

function risk(exposure) {
  if (exposure >= 0.5) return { label: 'Wysokie', tone: 'red' };
  if (exposure >= 0.2) return { label: 'Podwyższone', tone: 'amber' };
  if (exposure > 0) return { label: 'Niskie', tone: '' };
  return { label: 'Brak', tone: '' };
}

/** Obszar alertu wyświetlany na mapie: projekt w edycji albo ostatni wysłany alert. */
export function displayedAlertArea() {
  const s = store.getState();
  const d = store.activeDraft();
  if (d && d.status !== 'sent') return { ids: d.areaIds, label: `Projekt ${d.id}`, editable: true };
  const last = s.sent[s.sent.length - 1];
  if (last) return { ids: last.areaIds, label: `Aktywny ${last.id}`, editable: false };
  return { ids: [], label: 'Brak alertu', editable: false };
}

export function mapSvg({ compact = false } = {}) {
  const data = store.getData();
  const s = store.getState();
  const started = s.stage >= 1;
  const alertArea = displayedAlertArea();
  const incidents = started ? store.incidentsNow() : [];
  const order = [...data.areas.features.filter((f) => f.id !== 'P02'), store.areaById('P02')]; // miasto na wierzchu
  const km20 = Math.round(20 * data.meta.mapScale.kmPx); // podziałka 20 km w pikselach mapy
  return `<svg class="map-svg" viewBox="0 0 800 560" role="img" aria-label="Mapa powiatów: obszar zagrożenia, obszar alertu i zgłoszenia">
    ${order.map((f) => `<polygon class="area ${layers.alert && alertArea.ids.includes(f.id) ? 'alerted' : ''} ${!compact && selected === f.id ? 'selected' : ''}"
        data-area="${f.id}" points="${pts(f.geometry.coordinates[0])}"><title>${esc(f.properties.label)}</title></polygon>`).join('')}
    ${layers.river ? `<path class="river" d="${data.river.path}"/>` : ''}
    ${started && layers.hazard ? `<polygon class="hazard" points="${pts(data.hazardZones[s.phase])}"/>` : ''}
    ${order.map((f) => `<text class="area-label ${alertArea.ids.includes(f.id) ? 'strong' : ''}" x="${f.properties.labelAt[0]}" y="${f.properties.labelAt[1]}">${esc(f.properties.label)}</text>`).join('')}
    ${layers.incidents ? incidents.map((i) => `<circle class="inc ${i.phase === 'T2' ? 't2' : ''} ${i.unverified ? 'unverified' : ''}" cx="${i.at[0]}" cy="${i.at[1]}" r="${i.unverified ? 7 : 5.5}"><title>${esc(`${i.time} ${i.source}: ${i.type}`)}</title></circle>`).join('') : ''}
    <g transform="translate(740,500)"><path d="M0,-22 L6,-6 L0,-10 L-6,-6 Z" fill="var(--muted)"/><text x="0" y="8" fill="var(--muted)" font-size="11" text-anchor="middle">N</text></g>
    <g transform="translate(24,530)"><line x1="0" y1="0" x2="${km20}" y2="0" stroke="var(--muted)" stroke-width="2"/><line x1="0" y1="-4" x2="0" y2="4" stroke="var(--muted)"/><line x1="${km20}" y1="-4" x2="${km20}" y2="4" stroke="var(--muted)"/><text x="${km20 / 2}" y="-7" fill="var(--muted)" font-size="11" text-anchor="middle">20 km</text></g>
  </svg>`;
}

export const legend = () => `<div class="map-legend">
  <span class="legend-item"><span class="swatch red"></span>Obszar zagrożenia</span>
  <span class="legend-item"><span class="swatch amber"></span>Obszar alertu</span>
  <span class="legend-item"><span class="swatch blue"></span>Zgłoszenie zweryfikowane</span>
  <span class="legend-item"><span class="swatch ring"></span>Zgłoszenie niezweryfikowane</span>
</div>`;

// Zasięg alertu: jaka część mieszkańców strefy zagrożenia znajdzie się w obszarze alertu.
export function geoPanel(areaIds, { title = 'Zasięg alertu' } = {}) {
  if (!areaIds.length) {
    return panel(title, callout('warn', 'Strefa zagrożenia bez alertu', 'Mieszkańcy strefy zagrożenia nie są objęci żadnym Alertem RCB. Zasięg zostanie policzony po wybraniu obszaru alertu.'));
  }
  const g = store.geoAnalysis(areaIds);
  const warn = g.coverage < 0.9;
  return panel(title, `
    <p class="geo-lead">Czy alert dotrze do ludzi, którym grozi niebezpieczeństwo?</p>
    <div class="geo-big"><b>${pct(g.coverage)}</b> mieszkańców strefy zagrożenia otrzyma alert</div>
    <div class="coverage-meter ${warn ? 'warn' : ''}"><i style="width:${g.coverage * 100}%"></i><span class="threshold" title="Wymagane minimum 90%"></span></div>
    <div class="geo-row"><span class="faint">Wymagane minimum: 90%</span>${tag(g.passed ? 'Zasięg wystarczający' : 'Zasięg niewystarczający', g.passed ? 'green' : 'amber')}</div>
    <dl class="kv" style="margin-top:14px">
      <dt>Alert otrzyma</dt><dd>${g.alerted.toLocaleString('pl-PL')} osób</dd>
      <dt>Z tego poza strefą</dt><dd>${pct(g.outside)} <span class="faint" style="font-weight:400">— alert obejmuje zawsze cały powiat</span></dd>
    </dl>
    ${g.gaps.length ? `<div style="margin-top:12px">${callout('warn', 'Pominięty obszar', g.gaps.map((x) => `<b>${esc(x.label)}</b>: ${pct(x.exposure)} mieszkańców jest w strefie zagrożenia, a powiat nie jest w alercie. Rozważ dodanie.`).join('<br>'))}</div>` : ''}`);
}

export function render() {
  const s = store.getState();
  const alertArea = displayedAlertArea();
  const f = store.areaById(selected);
  const p = f.properties;
  const inc = s.stage >= 1 ? store.incidentsNow().filter((i) => i.areaId === selected) : [];
  const verified = inc.filter((i) => !i.unverified);
  const r = risk(s.stage >= 1 ? p.exposure[s.phase] : 0);
  const inAlert = alertArea.ids.includes(selected);
  const lastUpdate = inc.length ? inc.map((i) => i.time).sort().at(-1) : '—';

  const toggles = `<div class="layer-toggles">${[['hazard', 'Zagrożenie'], ['alert', 'Alert'], ['incidents', 'Zgłoszenia'], ['river', 'Dunajec']]
    .map(([k, l]) => `<label><input type="checkbox" data-layer="${k}" ${layers[k] ? 'checked' : ''}>${l}</label>`).join('')}</div>`;

  const areaInfo = panel('Wybrany obszar', `<dl class="kv">
      <dt>Obszar</dt><dd>${esc(p.label)} <span class="faint" style="font-weight:400">(${esc(p.kind)})</span></dd>
      <dt>Ryzyko</dt><dd>${tag(r.label, r.tone)}</dd>
      <dt>Zgłoszenia</dt><dd class="mono">${verified.length}${inc.length > verified.length ? ` <span class="faint">+${inc.length - verified.length} niezweryf.</span>` : ''}</dd>
      <dt>Alert</dt><dd>${inAlert ? tag(alertArea.label, alertArea.editable ? 'cyan' : 'green') : tag('Poza obszarem alertu')}</dd>
      <dt>Ostatnia aktualizacja</dt><dd class="mono">${esc(lastUpdate)}</dd>
      <dt>Populacja (synt.)</dt><dd class="mono">${p.population.toLocaleString('pl-PL')}</dd>
    </dl>
    ${alertArea.editable ? `<div style="margin-top:12px"><button class="btn sm ${inAlert ? '' : 'primary'}" data-toggle-area="${selected}">${inAlert ? 'Usuń z obszaru alertu' : 'Dodaj do obszaru alertu'}</button>
      <div class="faint" style="font-size:12px;margin-top:6px">Zmiana obszaru jest decyzją operatora i trafia do dziennika.</div></div>` : ''}`);

  return `${pageHead('03 Mapa', 'SIGNAL GEO', 'Analiza obszaru ostrzegania', `Obszar zagrożenia, obszar alertu i zgłoszenia. Alert obejmuje co najmniej cały powiat.`, toggles)}
    ${s.stage === 0 ? `<div style="margin-bottom:16px">${callout('info', 'Brak aktywnego scenariusza', 'Uruchom demo, aby zobaczyć obszar zagrożenia i zgłoszenia.')}</div>` : ''}
    <div class="grid g-main-side">
      <section class="panel">
        <header class="panel-head"><h2>Sytuacja o ${s.phase === 'T2' ? '18:30' : '17:56'}</h2>${tag(alertArea.label, alertArea.ids.length ? 'amber' : '')}</header>
        <div class="map-wrap">${mapSvg()}</div>
        ${legend()}
      </section>
      <div class="stack">
        ${areaInfo}
        ${panel('Położenie', `${polandSvg()}<div class="faint" style="font-size:12.5px;margin-top:8px">Granice powiatów: PRG (GUGiK). Zdarzenia i populacja w scenariuszu są fikcyjne.</div>`)}
      </div>
    </div>`;
}

export function mount(root, ctx) {
  loadPoland(ctx.refresh);
  root.querySelectorAll('[data-area]').forEach((el) => el.addEventListener('click', () => {
    selected = el.dataset.area;
    ctx.refresh();
  }));
  root.querySelectorAll('[data-layer]').forEach((el) => el.addEventListener('change', () => {
    layers[el.dataset.layer] = el.checked;
    ctx.refresh();
  }));
  root.querySelector('[data-toggle-area]')?.addEventListener('click', (e) => store.toggleDraftArea(e.currentTarget.dataset.toggleArea));
}
