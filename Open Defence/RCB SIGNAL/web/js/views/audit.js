// Dziennik audytu: KTO · KIEDY · CO · DLACZEGO · NA PODSTAWIE.

import * as store from '../store.js';
import { esc, pageHead, panel, tag } from '../ui.js';

const KIND = {
  decision: ['Decyzja', 'green'],
  recommendation: ['Rekomendacja', 'cyan'],
  system: ['System / źródło', ''],
};

let filter = 'all';

export function render() {
  const s = store.getState();
  const rows = s.audit.filter((a) => filter === 'all' || a.kind === filter);
  const filters = `<div class="layer-toggles">${[['all', 'Wszystkie'], ['decision', 'Decyzje'], ['recommendation', 'Rekomendacje'], ['system', 'System']]
    .map(([k, l]) => `<label><input type="radio" name="f" value="${k}" ${filter === k ? 'checked' : ''}>${l}</label>`).join('')}</div>`;
  // Podsumowanie dziennika: ile decyzji podjął człowiek, ile rekomendacji dał system, czas do pierwszej decyzji.
  const all = s.audit;
  const decisions = all.filter((a) => a.kind === 'decision');
  const recs = all.filter((a) => a.kind === 'recommendation');
  // Ten sam pomiar co w raporcie AAR: od wykrycia zdarzenia (pierwsza rekomendacja) do zatwierdzenia alertu.
  const first = recs[0]?.time;
  const firstDecision = decisions.find((a) => /^ZATWIERDZONO/.test(a.what))?.time;
  const mins = (a, b) => { const [h1, m1] = a.split(':').map(Number); const [h2, m2] = b.split(':').map(Number); return h2 * 60 + m2 - (h1 * 60 + m1); };
  const summary = `<dl class="ov-stats">
    <div class="ov-stat"><dt>Wpisy w dzienniku</dt><dd>${all.length}</dd></div>
    <div class="ov-stat"><dt>Decyzje dyżurnego</dt><dd>${decisions.length}</dd></div>
    <div class="ov-stat"><dt>Rekomendacje SIGNAL</dt><dd>${recs.length}</dd></div>
    <div class="ov-stat"><dt>Od wykrycia do zatwierdzenia alertu</dt><dd>${first && firstDecision ? `${mins(first, firstDecision)} min` : '—'}</dd></div>
  </dl>`;
  return `${pageHead('07 Dziennik audytu', 'AUDIT LOG', 'Dziennik decyzji')}
    ${summary}
    ${panel(`Wpisy (${rows.length})`, rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Kiedy</th><th>Kto</th><th>Typ</th><th>Co</th><th>Dlaczego</th><th>Na podstawie</th></tr></thead>
      <tbody>${rows.map((a) => `<tr>
        <td class="mono">${esc(a.time)}</td>
        <td class="mono" style="color:${a.who === 'SIGNAL' ? 'var(--accent)' : /^OP-/.test(a.who) ? 'var(--green)' : 'var(--muted)'}">${esc(a.who)}</td>
        <td>${tag(...KIND[a.kind])}</td>
        <td>${esc(a.what)}</td>
        <td class="muted" style="font-size:12.5px">${esc(a.why)}</td>
        <td class="mono faint" style="font-size:11.5px">${esc(a.basis)}</td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="empty">Brak wpisów. Uruchom scenariusz demonstracyjny.</div>', { bodyClass: 'tight', right: `${filters}<button class="btn sm" data-act="csv" ${rows.length ? '' : 'disabled'}>Eksportuj CSV</button>` })}
    <p class="faint" style="font-size:13px;margin-top:12px">Każdy wpis: kto, kiedy, co, dlaczego i na jakiej podstawie. Wpisy są tylko do odczytu.</p>`;
}

export function mount(root, ctx) {
  root.querySelectorAll('input[name="f"]').forEach((el) => el.addEventListener('change', () => { filter = el.value; ctx.refresh(); }));
  // Eksport bieżącego widoku dziennika do CSV (generowany w przeglądarce, bez serwera).
  root.querySelector('[data-act="csv"]')?.addEventListener('click', () => {
    const rows = store.getState().audit.filter((a) => filter === 'all' || a.kind === filter);
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [['czas', 'kto', 'typ', 'co', 'dlaczego', 'podstawa'], ...rows.map((a) => [a.time, a.who, KIND[a.kind][0], a.what, a.why, a.basis])]
      .map((r) => r.map(q).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'dziennik-audytu.csv' });
    link.click();
    URL.revokeObjectURL(url);
  });
}
