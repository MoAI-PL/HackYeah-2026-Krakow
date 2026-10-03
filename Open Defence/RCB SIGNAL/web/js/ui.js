// Wspólne elementy interfejsu.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`;

export const PRIORITY = {
  critical: { label: 'Krytyczny', tag: 'red' },
  high: { label: 'Wysoki', tag: 'amber' },
  medium: { label: 'Średni', tag: 'amber' },
  low: { label: 'Niski', tag: '' },
};

export const ALERT_STATE = {
  none: { label: 'Brak alertu', tag: '' },
  draft: { label: 'Alert w przygotowaniu', tag: 'cyan' },
  sent: { label: 'Alert aktywny', tag: 'green' },
};

export const VERIFICATION = {
  verified: { label: 'Zweryfikowane', tag: 'green', icon: '✓' },
  pending: { label: 'Niezweryfikowane', tag: 'amber', icon: '!' },
  quarantined: { label: 'Niezweryfikowane · kwarantanna', tag: 'red', icon: '✕' },
};

export const ICON = { ok: '✓', warn: '!', fail: '✕', error: '✕', info: 'i' };

export const ico = (status) => `<span class="ico ${status}" aria-hidden="true">${ICON[status] || '·'}</span>`;

export function tag(text, tone = '') {
  return `<span class="tag ${tone}">${esc(text)}</span>`;
}

export function panel(title, body, { right = '', bodyClass = '' } = {}) {
  return `<section class="panel">
    <header class="panel-head"><h2>${esc(title)}</h2>${right}</header>
    <div class="panel-body ${bodyClass}">${body}</div>
  </section>`;
}

export function pageHead(crumb, module, title, sub = '', actions = '') {
  return `<div class="page-head">
    <div>
      <div class="crumbs">${esc(crumb)} · <b>${esc(module)}</b></div>
      <h1>${esc(title)}</h1>
      ${sub ? `<div class="page-sub">${sub}</div>` : ''}
    </div>
    ${actions ? `<div class="btn-row">${actions}</div>` : ''}
  </div>`;
}

export function callout(tone, title, text) {
  return `<div class="callout ${tone}" role="${tone === 'error' ? 'alert' : 'status'}">
    ${ico(tone === 'error' ? 'fail' : tone === 'ok' ? 'ok' : tone === 'info' ? 'info' : 'warn')}
    <div><div class="callout-title">${esc(title)}</div>${text ? `<p>${text}</p>` : ''}</div>
  </div>`;
}

export const syntheticNote = (text = 'Dane syntetyczne — wyłącznie do demonstracji') => `<div class="synthetic-note">${esc(text)}</div>`;

/** Pierścień wyniku jakości z animacją wartości. */
export function scoreRing(score, { id = 'score', blocked = false } = {}) {
  const r = 48, c = 2 * Math.PI * r;
  const color = blocked ? 'var(--red)' : score >= 90 ? 'var(--green)' : score >= 75 ? 'var(--amber)' : 'var(--red)';
  return `<div class="score-ring" id="${id}" data-score="${score}">
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
      <circle cx="56" cy="56" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/>
      <circle class="arc" cx="56" cy="56" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="butt"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}" style="transition: stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1), stroke .4s"/>
    </svg>
    <div class="val"><div><b class="mono" data-count>${score}</b><span>${blocked ? 'BLOKADA' : '/ 100'}</span></div></div>
  </div>`;
}

/** Animuje pierścień wyniku od wartości `from` do bieżącej. */
export function animateScore(el, from) {
  if (!el) return;
  const to = Number(el.dataset.score);
  const arc = el.querySelector('.arc');
  const num = el.querySelector('[data-count]');
  const c = 2 * Math.PI * 48;
  arc.style.transition = 'none';
  arc.style.strokeDashoffset = c * (1 - from / 100);
  arc.getBoundingClientRect();
  arc.style.transition = '';
  requestAnimationFrame(() => { arc.style.strokeDashoffset = c * (1 - to / 100); });
  const t0 = performance.now(), dur = 1100;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    num.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Słupki porównawcze (jedna miara, dwa warianty) z podpowiedzią po najechaniu. */
export function compareChart({ title, unit, max, rows, better = 'higher' }) {
  const W = 420, rowH = 46, padL = 104, padR = 64, H = rows.length * rowH + 8;
  const scale = (v) => ((W - padL - padR) * v) / max;
  const bars = rows.map((r, i) => {
    const y = 8 + i * rowH;
    const w = Math.max(4, scale(r.value));
    const color = r.highlight ? 'var(--accent)' : 'var(--baseline)';
    const label = `${r.value}${unit === '%' ? '%' : ` ${unit}`}`;
    return `<g>
      <text x="0" y="${y + 19}" fill="var(--muted)" font-size="11" font-weight="600" letter-spacing="1">${esc(r.label)}</text>
      <rect x="${padL}" y="${y + 4}" width="${W - padL - padR}" height="22" fill="transparent" class="hit"
        data-tip="${esc(`${title} — ${r.label}: ${label}`)}"/>
      <path class="bar-rect" d="M${padL},${y + 6} h${w - 4} a4,4 0 0 1 4,4 v10 a4,4 0 0 1 -4,4 h-${w - 4} z" fill="${color}"
        data-tip="${esc(`${title} — ${r.label}: ${label}`)}"/>
      <text x="${padL + w + 8}" y="${y + 21}" fill="var(--text)" font-size="13" font-weight="700">${esc(label)}</text>
    </g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: ${rows.map((r) => `${r.label} ${r.value} ${unit}`).join(', ')}">
    <line x1="${padL}" y1="0" x2="${padL}" y2="${H}" stroke="var(--line-strong)"/>
    ${bars}
  </svg>
  <div class="faint mono" style="font-size:11px;margin-top:4px">${better === 'lower' ? '▼ mniej = lepiej' : '▲ więcej = lepiej'}</div>`;
}

let tipEl = null;
export function bindChartTips(root) {
  root.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chart-tip'; document.body.appendChild(tipEl); }
      tipEl.textContent = el.dataset.tip;
      tipEl.style.display = 'block';
      tipEl.style.left = `${Math.min(e.clientX + 14, window.innerWidth - 260)}px`;
      tipEl.style.top = `${e.clientY + 14}px`;
    });
    el.addEventListener('mouseleave', () => { if (tipEl) tipEl.style.display = 'none'; });
  });
}

/** Porównanie słów (LCS) do pokazania zmian w treści alertu. */
export function wordDiff(a, b) {
  const A = a.split(/\s+/).filter(Boolean), B = b.split(/\s+/).filter(Boolean);
  const m = A.length, n = B.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && A[i] === B[j]) { out.push(esc(A[i])); i++; j++; }
    else if (j >= n || (i < m && dp[i + 1][j] >= dp[i][j + 1])) { out.push(`<span class="diff-del">${esc(A[i])}</span>`); i++; }
    else { out.push(`<span class="diff-ins">${esc(B[j])}</span>`); j++; }
  }
  return out.join(' ');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
