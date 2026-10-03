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
  return `${pageHead('07 Dziennik audytu', 'AUDIT LOG', 'Dziennik decyzji', 'Każda decyzja ma autora, czas, uzasadnienie i podstawę danych. Wpisy są tylko do odczytu.', filters)}
    ${panel(`Wpisy (${rows.length})`, rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Kiedy</th><th>Kto</th><th>Typ</th><th>Co</th><th>Dlaczego</th><th>Na podstawie</th></tr></thead>
      <tbody>${rows.map((a) => `<tr>
        <td class="mono">${esc(a.time)}</td>
        <td class="mono" style="color:${a.who === 'SIGNAL' ? 'var(--accent)' : /^OP-/.test(a.who) ? 'var(--green)' : 'var(--muted)'}">${esc(a.who)}</td>
        <td>${tag(...KIND[a.kind])}</td>
        <td>${esc(a.what)}</td>
        <td class="muted" style="font-size:12.5px">${esc(a.why)}</td>
        <td class="mono faint" style="font-size:11.5px">${esc(a.basis)}</td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="empty">Brak wpisów. Uruchom scenariusz demonstracyjny.</div>', { bodyClass: 'tight' })}`;
}

export function mount(root, ctx) {
  root.querySelectorAll('input[name="f"]').forEach((el) => el.addEventListener('change', () => { filter = el.value; ctx.refresh(); }));
}
