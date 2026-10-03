// SCREEN 3 — SIGNAL GEO: obszar zagrożenia vs obszar alertu vs zgłoszenia.
// Mapa demonstracyjna fikcyjnego województwa (SVG, działa offline).

import * as store from '../store.js';
import { esc, pageHead, panel, tag, callout, pct, syntheticNote } from '../ui.js';

let selected = 'P02';
const layers = { hazard: true, alert: true, incidents: true, river: true };

const pts = (ring) => ring.map((p) => p.join(',')).join(' ');

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
  const grid = Array.from({ length: 9 }, (_, i) => `<line class="grid-line" x1="${i * 100}" y1="0" x2="${i * 100}" y2="560"/>`).join('')
    + Array.from({ length: 6 }, (_, i) => `<line class="grid-line" x1="0" y1="${i * 100}" x2="800" y2="${i * 100}"/>`).join('');
  return `<svg class="map-svg" viewBox="0 0 800 560" role="img" aria-label="Mapa demonstracyjna: obszar zagrożenia, obszar alertu i zgłoszenia">
    ${grid}
    ${order.map((f) => `<polygon class="area ${layers.alert && alertArea.ids.includes(f.id) ? 'alerted' : ''} ${!compact && selected === f.id ? 'selected' : ''}"
        data-area="${f.id}" points="${pts(f.geometry.coordinates[0])}"><title>${esc(f.properties.label)}</title></polygon>`).join('')}
    ${layers.river ? `<path class="river" d="${data.river.path}"/>` : ''}
    ${started && layers.hazard ? `<polygon class="hazard" points="${pts(data.hazardZones[s.phase])}"/>` : ''}
    ${order.map((f) => `<text class="area-label ${alertArea.ids.includes(f.id) ? 'strong' : ''}" x="${f.properties.labelAt[0]}" y="${f.properties.labelAt[1]}">${esc(f.properties.label)}</text>`).join('')}
    ${layers.incidents ? incidents.map((i) => `<circle class="inc ${i.phase === 'T2' ? 't2' : ''} ${i.unverified ? 'unverified' : ''}" cx="${i.at[0]}" cy="${i.at[1]}" r="${i.unverified ? 7 : 5.5}"><title>${esc(`${i.time} ${i.source}: ${i.type}`)}</title></circle>`).join('') : ''}
    <g transform="translate(740,500)"><path d="M0,-22 L6,-6 L0,-10 L-6,-6 Z" fill="var(--muted)"/><text x="0" y="8" fill="var(--muted)" font-size="11" text-anchor="middle" font-family="var(--mono)">N</text></g>
    <g transform="translate(24,530)"><line x1="0" y1="0" x2="100" y2="0" stroke="var(--muted)" stroke-width="2"/><line x1="0" y1="-4" x2="0" y2="4" stroke="var(--muted)"/><line x1="100" y1="-4" x2="100" y2="4" stroke="var(--muted)"/><text x="50" y="-7" fill="var(--muted)" font-size="10" text-anchor="middle" font-family="var(--mono)">10 km (umowne)</text></g>
  </svg>`;
}

export const legend = () => `<div class="map-legend">
  <span class="legend-item"><span class="swatch red"></span>Obszar zagrożenia</span>
  <span class="legend-item"><span class="swatch amber"></span>Obszar alertu</span>
  <span class="legend-item"><span class="swatch blue"></span>Zgłoszenie zweryfikowane</span>
  <span class="legend-item"><span class="swatch ring"></span>Zgłoszenie niezweryfikowane</span>
</div>`;

export function geoPanel(areaIds, { title = 'Analiza SIGNAL GEO' } = {}) {
  if (!areaIds.length) {
    return panel(title, `${callout('warn', 'Brak obszaru alertu', 'Populacja w strefie zagrożenia nie jest objęta żadnym Alertem RCB. Obszar zostanie oceniony po przygotowaniu projektu alertu.')}
      ${syntheticNote('Dane zagregowane · bez danych osobowych')}`);
  }
  const g = store.geoAnalysis(areaIds);
  const warn = g.coverage < 0.9;
  return panel(title, `
    <div class="stat-label">Pokrycie populacji w obszarze zagrożenia</div>
    <div style="display:flex;align-items:baseline;gap:10px"><span class="stat-value" style="font-size:28px">${pct(g.coverage)}</span>${tag(g.passed ? 'Walidacja: pozytywna' : 'Luka w pokryciu', g.passed ? 'green' : 'amber')}</div>
    <div class="coverage-meter ${warn ? 'warn' : ''}"><i style="width:${g.coverage * 100}%"></i><span class="threshold" title="Próg 90%"></span></div>
    <div class="faint mono" style="font-size:11px">PRÓG WALIDACJI 90%</div>
    <dl class="kv" style="margin-top:14px">
      <dt>Odbiorcy w obszarze alertu</dt><dd class="mono">${g.alerted.toLocaleString('pl-PL')}</dd>
      <dt>Poza obszarem zagrożenia</dt><dd class="mono">${pct(g.outside)} <span class="faint" style="font-weight:400">(granulacja: powiat)</span></dd>
    </dl>
    ${g.gaps.length ? `<div style="margin-top:12px">${callout('warn', 'Potencjalna luka', g.gaps.map((x) => `<b>${esc(x.label)}</b> — ${pct(x.exposure)} populacji w strefie zagrożenia, poza obszarem alertu.`).join('<br>'))}</div>` : ''}
    ${syntheticNote('Dane zagregowane · bez danych osobowych · populacja syntetyczna')}`);
}

export function render() {
  const s = store.getState();
  const data = store.getData();
  const alertArea = displayedAlertArea();
  const f = store.areaById(selected);
  const p = f.properties;
  const inc = s.stage >= 1 ? store.incidentsNow().filter((i) => i.areaId === selected) : [];
  const verified = inc.filter((i) => !i.unverified);
  const r = risk(s.stage >= 1 ? p.exposure[s.phase] : 0);
  const inAlert = alertArea.ids.includes(selected);
  const lastUpdate = inc.length ? inc.map((i) => i.time).sort().at(-1) : '—';

  const toggles = `<div class="layer-toggles">${[['hazard', 'Zagrożenie'], ['alert', 'Alert'], ['incidents', 'Zgłoszenia'], ['river', 'Rzeka']]
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

  return `${pageHead('03 Mapa', 'SIGNAL GEO', 'Analiza obszaru ostrzegania', `Obszar zagrożenia → obszar alertu → dystrybucja. Najmniejsza jednostka dystrybucji: powiat. · ${esc(data.meta.region)}`, toggles)}
    ${s.stage === 0 ? `<div style="margin-bottom:16px">${callout('info', 'Brak aktywnego scenariusza', 'Uruchom demo, aby zobaczyć obszar zagrożenia i zgłoszenia.')}</div>` : ''}
    <div class="grid g-main-side">
      <section class="panel">
        <header class="panel-head"><h2>Mapa sytuacyjna · ${s.phase === 'T2' ? 'stan 18:30' : 'stan 17:56'}</h2>${tag(alertArea.label, alertArea.ids.length ? 'amber' : '')}</header>
        <div class="map-wrap">${mapSvg()}</div>
        ${legend()}
      </section>
      <div class="stack">
        ${areaInfo}
        ${s.stage >= 1 ? geoPanel(alertArea.ids) : ''}
      </div>
    </div>`;
}

export function mount(root, ctx) {
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
