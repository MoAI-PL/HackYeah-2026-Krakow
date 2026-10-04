// SCREEN 4–6 — SIGNAL WRITER: projekt → analiza jakości → zatwierdzenie (człowiek) → symulowana dystrybucja.

import * as store from '../store.js';
import { analyze } from '../services.js';
import { SMS_LIMIT } from '../analyzer.js';
import { esc, pageHead, panel, tag, callout, pct, ico, scoreRing, animateScore, wordDiff, sleep, syntheticNote } from '../ui.js';
import { geoPanel } from './map.js';

const CRITERIA = [
  ['what', 'WHAT', 'Co się dzieje'],
  ['where', 'WHERE', 'Gdzie'],
  ['when', 'WHEN', 'Kiedy / do kiedy'],
  ['action', 'ACTION', 'Co zrobić'],
  ['length', 'LENGTH', 'Limit SMS'],
  ['consistency', 'CONSISTENCY', 'Spójność ze źródłami'],
  ['clarity', 'CLARITY', 'Czytelność'],
];

let busy = null;            // 'analyzing' — trwa animacja analizy
let pendingAnim = null;     // { from } — animacja pierścienia po ponownym renderze
let animateDistribution = false;
let scrollTarget = null;      // panel, który ma być widoczny po ponownym renderze
const advisory = {};        // opinie doradcze LLM per projekt

// ---------------------------------------------------------------- fragmenty

function charRow(text) {
  const n = [...text].length;
  const over = n > SMS_LIMIT;
  return `<div class="char-row">
    <div class="char-meter ${over ? 'over' : ''}" aria-hidden="true"><i style="width:${Math.min(100, (n / SMS_LIMIT) * 100)}%"></i></div>
    <span class="char-count ${over ? 'over' : ''}" data-chars>${n} / ${SMS_LIMIT} znaków</span>
  </div>`;
}

function phonePreview(text) {
  return `<div class="phone-preview" aria-label="Podgląd wiadomości u odbiorcy">
    <div class="from">Alert RCB</div>
    <div class="bubble" data-preview>${esc(text) || '<span class="faint">—</span>'}</div>
  </div>`;
}

function qualityPanel(d) {
  if (busy === 'analyzing') {
    return panel('Kontrola jakości', `<div class="callout-title" style="margin-bottom:12px;color:var(--accent)">Analizuję komunikat…</div>
      <ol class="progress-steps" id="analysis-steps">
        ${['3 źródła zweryfikowane', 'Spójność geograficzna sprawdzona', 'Struktura komunikatu sprawdzona', 'Limit znaków i kodowanie sprawdzone'].map((l) => `<li><span class="ico">·</span>${l}</li>`).join('')}
      </ol>`);
  }
  const a = d.analysis;
  if (!a) {
    return panel('Kontrola jakości', `<div class="muted">Kliknij <b>Analizuj</b>, aby sprawdzić, czy komunikat mówi co, gdzie, kiedy i co zrobić, czy mieści się w limicie znaków i czy zgadza się ze źródłami.</div>
`);
  }
  const stale = d.analyzedText !== d.text;
  const out = store.outageFeed();
  const outageBox = out && ['IMGW', 'PSP', 'WCZK'].includes(out.id) ? `<div style="margin-bottom:12px">${callout('warn', `Brak aktualnych danych: ${out.name}`, `Zgodność ze źródłami sprawdzono na ostatnich dostępnych danych${out.id === 'IMGW' ? ' (godzina zakończenia z ostatniego ostrzeżenia)' : ''}. ${esc(out.fallback)}.`)}</div>` : '';
  const hist = d.scoreHistory;
  const delta = hist.length > 1 ? hist[hist.length - 1] - hist[hist.length - 2] : 0;
  const crit = CRITERIA.map(([k, code, desc]) => {
    const c = a.checks[k];
    return `<div class="criterion ${c.status}">
      <div class="c-head">${ico(c.status)}<span>${code}</span><span class="c-pts" style="margin-left:auto">${c.points}/${c.max}</span></div>
      <div class="faint" style="font-size:11.5px">${desc}</div>
      <div class="c-bar"><i style="width:${(c.points / c.max) * 100}%"></i></div>
    </div>`;
  }).join('');
  const issues = a.issues.length ? `<ul class="checklist" style="margin-top:14px">${a.issues.map((i) => `<li>${ico(i.severity === 'error' ? 'fail' : i.severity)}<span><b>${esc(i.criterion)}</b> — ${esc(i.message)}</span></li>`).join('')}</ul>`
    : `<div style="margin-top:14px">${callout('ok', 'Brak uwag', 'Komunikat spełnia wszystkie kryteria.')}</div>`;
  const blocking = a.issues.filter((i) => i.severity === 'error');
  const blockingBox = blocking.length ? `<div style="margin-top:12px">${callout('error', blocking.some((b) => b.criterion === 'LENGTH') ? `Przekroczony limit znaków — ${a.checks.length.chars} / ${SMS_LIMIT}` : blocking.some((b) => b.criterion === 'ACTION') ? 'Wymagana instrukcja działania' : 'Błąd blokujący', blocking.some((b) => b.criterion === 'ACTION') ? 'Odbiorca może nie wiedzieć, co zrobić. Zatwierdzenie zablokowane do czasu poprawy.' : 'Zatwierdzenie zablokowane do czasu poprawy.')}</div>` : '';
  const sugg = a.suggestion && a.suggestion !== d.text && d.status !== 'sent' ? `<div class="suggestion" style="margin-top:14px">
      <div class="callout-title" style="color:var(--accent)">Rekomendacja SIGNAL</div>
      <div class="s-text">${wordDiff(d.text, a.suggestion)}</div>
      <div class="btn-row"><button class="btn primary" data-act="apply">Zastosuj rekomendację</button><span class="faint" style="font-size:13px">${[...a.suggestion].length}/${SMS_LIMIT} znaków, bez polskich znaków (GSM-7). Dyżurny może dalej edytować.</span></div>
    </div>` : '';
  const adv = advisory[d.id];
  const advBox = adv ? (adv.unavailable
    ? `<div style="margin-top:12px">${callout('info', 'Opinia LLM niedostępna', 'Dostawca zewnętrzny nie odpowiedział — wynik regułowy pozostaje wiążący.')}</div>`
    : `<div style="margin-top:12px" class="callout info"><span class="ico info">i</span><div><div class="callout-title">Opinia doradcza modelu językowego (nie wpływa na wynik)</div>
        <p>${esc((adv.issues || []).join(' · ') || 'Brak dodatkowych uwag.')}</p>${adv.suggestion ? `<p class="mono">${esc(adv.suggestion)}</p>` : ''}</div></div>`) : '';

  return panel('Kontrola jakości', `<span id="quality-anchor"></span>
    ${outageBox}${stale ? `<div style="margin-bottom:12px">${callout('warn', 'Treść zmieniona po analizie', 'Wynik dotyczy poprzedniej wersji. Kliknij Analizuj ponownie.')}</div>` : ''}
    <div class="score-block">
      ${scoreRing(a.score, { id: 'score-ring', blocked: a.blocking })}
      <div>
        <div class="stat-label">Actionability score</div>
        <div style="font-size:14px;margin-top:6px" class="muted">Czy odbiorca wie, co się dzieje i co ma zrobić.<br>Ocena regułowa, deterministyczna.</div>
        ${a.blocking ? `<div class="score-delta" style="color:var(--red)">✕ Błąd blokujący — zatwierdzenie niemożliwe</div>` : ''}
        ${delta ? `<div class="score-delta">${delta > 0 ? '▲ +' : '▼ '}${delta} pkt względem poprzedniej wersji</div>` : ''}
        ${hist.length > 1 ? `<div class="faint" style="font-size:13px;margin-top:6px">Historia: ${hist.join(' → ')}</div>` : ''}
      </div>
    </div>
    <details class="crit-details"${pendingAnim || a.blocking ? ' open' : ''}><summary>Szczegóły oceny (7 kryteriów)</summary><div class="criteria">${crit}</div></details>
    ${issues}${blockingBox}${sugg}${advBox}
    ${syntheticNote('Ocena dotyczy konstrukcji komunikatu, nie prawdziwości informacji.')}`, { right: tag(stale ? 'Nieaktualna' : 'Aktualna', stale ? 'amber' : 'green') });
}

function approvalPanel(d) {
  const a = d.analysis;
  const srcs = store.sourcesFor(d.eventId).filter((s) => s.verification === 'verified').length;
  const geo = store.geoAnalysis(d.areaIds, d.kind === 'update' ? 'T2' : store.getState().phase);
  const len = a.checks.length;
  const items = [
    ['Actionability', `${a.score} / 100`, a.score >= 90 ? 'pass' : 'warn'],
    ['Źródła faktograficzne', `${srcs} zweryf.`, srcs >= 2 ? 'pass' : 'warn'],
    ['Walidacja GEO', geo.passed ? `OK, ${pct(geo.coverage)}` : `Luka, ${pct(geo.coverage)}`, geo.passed ? 'pass' : 'warn'],
    ['Limit znaków', `${len.chars} / ${SMS_LIMIT}`, len.status === 'fail' ? 'fail' : 'pass'],
  ];
  const defaultWhy = d.kind === 'update'
    ? 'Rozszerzenie zagrożenia na pow. limanowski (PSP, WCZK) i wydłużenie ostrzeżenia IMGW do 23:00.'
    : 'Zagrożenie potwierdzone przez 3 niezależne źródła (IMGW, PSP, WCZK); ryzyko dla mienia i zdrowia.';
  return `<section class="panel" id="approval-panel" style="border-color:var(--green)">
    <header class="panel-head"><h2>Alert gotowy do zatwierdzenia · ${esc(d.id)}</h2>${tag('Wymagana decyzja operatora', 'amber')}</header>
    <div class="panel-body stack" style="gap:14px">
      <div class="approval-grid">${items.map(([l, v, st]) => `<div class="approval-item ${st}"><div class="stat-label">${l}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
      ${!geo.passed ? callout('warn', 'Walidacja GEO z uwagami', 'Obszar alertu nie pokrywa w pełni obszaru zagrożenia. Zatwierdzenie możliwe — decyzja zostanie odnotowana.') : ''}
      <label class="field">Uzasadnienie decyzji (zapis w dzienniku audytu)
        <textarea id="why" rows="2">${esc(defaultWhy)}</textarea>
      </label>
      <label class="confirm-row"><input type="checkbox" id="confirm"><span>Potwierdzam weryfikację treści, obszaru i źródeł. Rozumiem, że w środowisku demonstracyjnym wysyłka jest <b>wyłącznie symulowana</b>.</span></label>
      <div class="btn-row">
        <button class="btn" data-act="edit">Wróć do edycji</button>
        <span style="flex:1"></span>
        <button class="btn approve" data-act="approve" disabled>Zatwierdź i symuluj wysyłkę</button>
      </div>
      <div class="faint" style="font-size:12px">${store.OPERATOR.id} · ${store.OPERATOR.role} · SIGNAL nie może samodzielnie wysłać, odwołać ani zmienić obszaru alertu.</div>
    </div>
  </section>`;
}

function distributionPanel(rec) {
  const ops = store.getData().distribution.operators;
  const labels = rec.areaIds.map((id) => store.areaById(id).properties.label).join(', ');
  return `<section class="panel" id="distribution-panel">
    <header class="panel-head"><h2>Symulowana dystrybucja · ${esc(rec.id)}</h2>${tag('Symulacja zakończona', 'green')}</header>
    <div class="panel-body">
      <div class="pipeline">${['Walidacja', 'Zatwierdzono', 'Dystrybucja zainicjowana', 'Dostarczono (symulacja)'].map((l) => `<div class="p-step done">${l}</div>`).join('')}</div>
      <dl class="kv" style="margin:16px 0">
        <dt>Obszar docelowy</dt><dd>${esc(labels)}</dd>
        <dt>Zatwierdzono</dt><dd>${esc(rec.approvedAt)} · ${store.OPERATOR.id}</dd>
        <dt>Szacowany zasięg</dt><dd style="font-size:22px;color:var(--accent)">${pct(rec.reach)}</dd>
      </dl>
      <div class="stat-label" style="margin-bottom:6px">Raportowanie operatorów (symulacja)</div>
      ${ops.map((o) => `<div class="op-row"><span>${esc(o.name)}</span><div class="op-bar"><i data-w="${o[rec.phase] * 100}" style="width:${animateDistribution ? 0 : o[rec.phase] * 100}%"></i></div><span class="mono num">${pct(o[rec.phase])}</span></div>`).join('')}
      ${store.getState().outage === 'OPS' ? `<div style="margin-top:12px">${callout('warn', 'Brak raportów operatorów', 'Zasięg i czas dostarczenia pochodzą z ostatnich danych i modelu pokrycia — do potwierdzenia, gdy operatorzy przyślą raporty.')}</div>` : ''}
      ${deliveryTable(rec.phase)}
      ${store.getState().stage === 7 ? '<div class="btn-row" style="margin-top:16px"><button class="btn primary" data-action="advance">Pobierz nowe dane źródłowe (18:30)</button></div>' : ''}
    </div>
  </section>`;
}

// Czas dostarczenia per operator — pokazuje, że ludzie w tym samym powiecie dostają alert w różnym czasie.
function deliveryTable(phase) {
  const del = store.deliveryStats(phase);
  return `<div class="dlv-block"><div class="stat-label" style="margin:16px 0 6px">Czas dostarczenia (symulacja)</div>
    <table class="dlv"><thead><tr><th>Operator</th><th class="num">Mediana</th><th class="num">95% odbiorców</th></tr></thead>
    <tbody>${del.rows.map((r) => `<tr class="${r === del.slowest && del.warn ? 'slow' : ''}"><td>${esc(r.name)}</td><td class="num">${store.fmtSec(r.p50)}</td><td class="num">${store.fmtSec(r.p95)}</td></tr>`).join('')}</tbody></table>
    ${del.warn ? `<div style="margin-top:12px">${callout('warn', 'Nierówny czas dostarczenia', `${esc(del.slowest.name)} dociera do 95% odbiorców po <b>${store.fmtSec(del.slowest.p95)}</b>, najszybszy operator po ${store.fmtSec(del.fastest)}. Osoby w tym samym powiecie dostają alert w różnym czasie — zapisano w dzienniku do wyjaśnienia z operatorem.`)}</div>` : ''}</div>`;
}

// Inne alerty RCB w wybranych powiatach (7 dni) — przeciwdziała zmęczeniu alertami i sprzecznym komunikatom.
function loadPanel(d) {
  const items = store.alertLoad(d.areaIds);
  const revoked = store.getState().revoked || [];
  return `<div class="load-panel">${panel('Inne alerty w tych powiatach', items.length ? `<p class="muted" style="margin:0 0 10px;font-size:14px">W ostatnich 7 dniach: <b>${items.length}</b> ${items.length === 1 ? 'alert' : 'alerty'}. Kolejny komunikat trafi do tych samych osób.</p>
    ${items.map((x) => `<div class="load-item">
      <div><b>${esc(x.title)}</b> <span class="faint">· ${esc(x.areas.join(', '))}</span></div>
      <div class="muted" style="font-size:13px;margin-top:2px">${x.active ? `Alert aktywny od ${esc(x.since)}` : 'Alert zakończony'}${x.note ? ` · ${esc(x.note)}` : ''}</div>
      ${x.active && !revoked.includes(x.id) ? `<button class="btn sm" style="margin-top:8px" data-revoke="${esc(x.id)}">Zaplanuj odwołanie</button>` : ''}
    </div>`).join('')}` : '<p class="muted" style="margin:0;font-size:14px">Brak innych alertów w tych powiatach w ostatnich 7 dniach.</p>')}</div>`;
}

function areaPicker(d) {
  const s = store.getState();
  const phase = d.kind === 'update' ? 'T2' : s.phase;
  const gaps = store.geoAnalysis(d.areaIds, phase).gaps.map((g) => g.id);
  const locked = d.status === 'sent' || d.status === 'review';
  return panel('Obszar dystrybucji', `<div class="area-picker">
    ${store.getData().areas.features.map((f) => `<label class="area-opt ${gaps.includes(f.id) ? 'gap' : ''}">
      <input type="checkbox" data-area="${f.id}" ${d.areaIds.includes(f.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}>
      <span>${esc(f.properties.label)}</span>
      <span class="exp">${f.properties.exposure[phase] ? `${pct(f.properties.exposure[phase])} w strefie` : '—'}</span>
    </label>`).join('')}
  </div><div class="faint" style="font-size:13px;margin-top:8px">% to udział populacji powiatu w strefie zagrożenia. <a href="#/map">Pokaż na mapie</a></div>`);
}

// Etapy tworzenia alertu — pokazują dyżurnemu, na którym kroku jest.
function steps(d, sentRec) {
  const at = sentRec ? 4 : d.status === 'review' ? 3 : d.analysis ? 2 : 1;
  return `<ol class="wr-steps">${['Treść', 'Ocena jakości', 'Zatwierdzenie', 'Wysyłka (symulacja)']
    .map((l, i) => `<li class="${i + 1 < at || (sentRec && i === 3) ? 'done' : i + 1 === at ? 'current' : ''}"><span>${i + 1}</span>${l}</li>`).join('')}</ol>`;
}

function otherDrafts() {
  const data = store.getData();
  const rows = data.alerts.filter((a) => a.eventId !== data.meta.mainEventId);
  return panel('Komunikaty dla pozostałych zdarzeń', `<div class="table-wrap"><table>
    <thead><tr><th>Zdarzenie</th><th>Treść</th><th>Status</th></tr></thead>
    <tbody>${rows.map((a) => `<tr><td><b>${esc(data.events.find((e) => e.id === a.eventId).title)}</b></td>
      <td style="font-size:13.5px">${esc(a.text)}</td>
      <td>${a.status === 'sent' ? tag(`Wysłany ${a.sentAt}`, 'green') : tag('Projekt', 'cyan')}</td></tr>`).join('')}</tbody>
  </table></div>`, { bodyClass: 'tight' });
}

// ---------------------------------------------------------------- widok

export function render() {
  const s = store.getState();
  const d = store.activeDraft();
  const data = store.getData();

  if (!d) {
    const body = s.stage === 2
      ? `<div class="empty"><div>Zdarzenie EVT-2026-1042 nie ma jeszcze projektu alertu.</div><button class="btn primary" data-act="create">Przygotuj projekt alertu</button></div>`
      : `<div class="empty">${s.stage < 2 ? 'Brak projektu alertu. Najpierw otwórz i przeanalizuj zdarzenie EVT-2026-1042.' : 'Brak aktywnego projektu.'}</div>`;
    return `${pageHead('04 Alerty', 'SIGNAL WRITER', 'Przygotowanie komunikatu')}${panel('Projekt alertu', body)}<div style="margin-top:16px">${otherDrafts()}</div>`;
  }

  const isUpdate = d.kind === 'update';
  const sentRec = s.sent.find((a) => a.id === d.id);
  const prevSent = isUpdate ? s.sent.find((a) => a.kind === 'initial') : null;
  const editable = d.status === 'draft' || d.status === 'analyzed';
  const canSubmit = editable && d.analysis && !d.analysis.blocking && d.analyzedText === d.text;
  const variants = data.testVariants;

  const editor = panel(isUpdate ? 'Treść aktualizacji' : 'Treść alertu', `
    ${isUpdate && prevSent ? `<div style="margin-bottom:12px">${callout('info', `Aktualizacja alertu ${prevSent.id}`, `Zmiany względem wysłanej wersji:<br><span class="mono" style="font-size:12.5px">${wordDiff(prevSent.text, d.text)}</span>`)}</div>` : ''}
    <textarea class="sms-editor" id="sms" spellcheck="false" aria-label="Treść alertu" ${editable ? '' : 'disabled'}>${esc(d.text)}</textarea>
    ${charRow(d.text)}
    <div class="btn-row" style="margin-top:14px">
      <button class="btn primary" data-act="analyze" ${editable && !busy ? '' : 'disabled'}>Analizuj</button>
      <button class="btn approve" data-act="submit" ${canSubmit ? '' : 'disabled'} title="${d.analysis?.blocking ? 'Błąd blokujący — popraw komunikat' : !d.analysis ? 'Najpierw wykonaj analizę' : ''}">Przekaż do zatwierdzenia →</button>
      <span style="flex:1"></span>
      ${editable ? `<select id="variant" class="variant-select" aria-label="Wariant testowy">
        <option value="">Przykłady błędów…</option>
        ${variants.map((v) => `<option value="${v.id}">${esc(v.label)}</option>`).join('')}
        <option value="__draft">Przywróć projekt wyjściowy</option>
      </select>` : ''}
    </div>
  `, { right: `<span class="mono faint" style="font-size:12.5px">${esc(d.id)}</span>` + tag(d.status === 'sent' ? 'Wysłany (symulacja)' : d.status === 'review' ? 'Do zatwierdzenia' : d.analysis ? 'Przeanalizowany' : 'Projekt', d.status === 'sent' ? 'green' : d.status === 'review' ? 'amber' : 'cyan') });

  return `${pageHead('04 Alerty', 'SIGNAL WRITER', isUpdate ? 'Aktualizacja alertu' : 'Nowy alert', `Zdarzenie <a href="#/events/${esc(d.eventId)}">${esc(d.eventId)}</a>`)}
    ${steps(d, sentRec)}
    <div class="grid g-main-side">
      <div class="stack">
        ${editor}
        ${d.status === 'review' ? approvalPanel(d) : ''}
        ${sentRec ? distributionPanel(sentRec) : ''}
        ${qualityPanel(d)}
      </div>
      <div class="stack">
        ${panel('Tak zobaczy to odbiorca', phonePreview(d.text))}
        ${areaPicker(d)}
        ${loadPanel(d)}
        ${geoPanel(d.areaIds)}
      </div>
    </div>`;
}

async function runAnalyzeSequence(ctx) {
  const d = store.activeDraft();
  const text = d.text;
  busy = 'analyzing';
  scrollTarget = '#analysis-steps';
  ctx.refresh();
  const steps = document.querySelectorAll('#analysis-steps li');
  for (const li of steps) {
    await sleep(320);
    li.classList.add('done');
    li.querySelector('.ico').textContent = '✓';
  }
  await sleep(250);
  busy = null;
  pendingAnim = { from: 0 };
  scrollTarget = '#quality-anchor';
  const result = store.runAnalysis();
  store.toast(`Analiza zakończona: wynik ${result.score}/100, uwagi: ${result.issues.length}.`, result.blocking ? 'error' : result.score >= 90 ? 'ok' : 'warn');
  // Opinia doradcza LLM (jeśli skonfigurowano) — nie zmienia wyniku.
  const full = await analyze(text, store.analysisContext(d));
  if (full.advisory) { advisory[d.id] = full.advisory; ctx.refresh(); }
}

async function runApproveSequence(why, ctx) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const labels = ['Walidacja', 'Zatwierdzono', 'Dystrybucja zainicjowana', 'Dostarczono (symulacja)'];
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Symulowana wysyłka">
    <header class="panel-head"><h2>Symulowana wysyłka</h2>${tag('Środowisko demonstracyjne', 'amber')}</header>
    <div class="panel-body">
      <div class="pipeline">${labels.map((l, i) => `<div class="p-step" data-i="${i}">${l}</div>`).join('')}</div>
      <div id="pipe-msg" style="font-size:14px;font-weight:600;color:var(--accent)">Walidacja…</div>
      <div class="faint" style="font-size:12px">Żadna wiadomość nie jest wysyłana do rzeczywistych odbiorców.</div>
    </div></div>`;
  document.body.appendChild(overlay);
  const msgs = ['Walidacja…', 'Zatwierdzono, decyzja zapisana w dzienniku', 'Dystrybucja zainicjowana (symulacja)', 'Symulowane dostarczenie zakończone'];
  for (let i = 0; i < labels.length; i++) {
    const el = overlay.querySelector(`[data-i="${i}"]`);
    el.classList.add('run');
    overlay.querySelector('#pipe-msg').textContent = msgs[i];
    await sleep(700);
    el.classList.remove('run');
    el.classList.add('done');
  }
  await sleep(400);
  overlay.remove();
  animateDistribution = true;
  scrollTarget = '#distribution-panel';
  const d = store.activeDraft();
  store.approve(why);
  store.toast(`${d.id} zatwierdzony przez ${store.OPERATOR.id}. Symulowana dystrybucja zakończona.`, 'ok');
}

export function mount(root, ctx) {
  const d = store.activeDraft();
  root.querySelector('[data-act="create"]')?.addEventListener('click', () => store.createDraft());
  if (!d) return;

  const ta = root.querySelector('#sms');
  ta?.addEventListener('input', () => {
    store.updateDraftText(ta.value);
    const n = [...ta.value].length;
    const over = n > SMS_LIMIT;
    const counter = root.querySelector('[data-chars]');
    counter.textContent = `${n} / ${SMS_LIMIT} znaków`;
    counter.classList.toggle('over', over);
    const meter = root.querySelector('.char-meter');
    meter.classList.toggle('over', over);
    meter.querySelector('i').style.width = `${Math.min(100, (n / SMS_LIMIT) * 100)}%`;
    root.querySelector('[data-preview]').textContent = ta.value;
    const submit = root.querySelector('[data-act="submit"]');
    if (submit) submit.disabled = true;
  });

  root.querySelector('[data-act="analyze"]')?.addEventListener('click', () => runAnalyzeSequence(ctx));
  root.querySelector('[data-act="apply"]')?.addEventListener('click', () => {
    const before = d.analysis.score;
    pendingAnim = { from: before };
    const r = store.applySuggestion();
    store.toast(`Rekomendacja zastosowana: ${r.before} → ${r.after} pkt.`, 'ok');
  });
  root.querySelector('[data-act="submit"]')?.addEventListener('click', () => {
    scrollTarget = '#approval-panel';
    if (store.submitForReview()) store.toast('Projekt przekazany do zatwierdzenia.', 'info');
  });
  root.querySelector('#variant')?.addEventListener('change', (e) => {
    const v = e.target.value;
    if (!v) return;
    pendingAnim = { from: d.analysis?.score ?? 0 };
    scrollTarget = '#quality-anchor';
    if (v === '__draft') {
      const original = d.kind === 'update' ? d.text : store.getData().alerts.find((a) => a.id === d.id).text;
      store.loadVariant(original);
    } else {
      store.loadVariant(store.getData().testVariants.find((x) => x.id === v).text);
    }
  });
  root.querySelectorAll('[data-area]').forEach((el) => el.addEventListener('change', () => store.toggleDraftArea(el.dataset.area)));
  root.querySelectorAll('[data-revoke]').forEach((el) => el.addEventListener('click', () => {
    store.revokeAlert(el.dataset.revoke);
    store.toast('Odwołanie alertu zaplanowane i zapisane w dzienniku.', 'ok');
  }));

  // Zatwierdzanie
  const confirmBox = root.querySelector('#confirm');
  const approveBtn = root.querySelector('[data-act="approve"]');
  confirmBox?.addEventListener('change', () => { approveBtn.disabled = !confirmBox.checked || !root.querySelector('#why').value.trim(); });
  root.querySelector('#why')?.addEventListener('input', (e) => { approveBtn.disabled = !confirmBox.checked || !e.target.value.trim(); });
  approveBtn?.addEventListener('click', () => runApproveSequence(root.querySelector('#why').value.trim(), ctx));
  root.querySelector('[data-act="edit"]')?.addEventListener('click', () => store.requestChanges('Edycja przez operatora przed zatwierdzeniem'));
  root.querySelector('[data-act="changes"]')?.addEventListener('click', () => {
    const reason = prompt('Powód zwrotu do poprawy (zapis w dzienniku):', 'Doprecyzować instrukcję działania');
    if (reason !== null) store.requestChanges(reason);
  });

  // Przewinięcie i animacje po ponownym renderze
  if (scrollTarget) {
    const el = root.querySelector(scrollTarget);
    scrollTarget = null;
    if (el) requestAnimationFrame(() => el.closest('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  if (pendingAnim) {
    animateScore(root.querySelector('#score-ring'), pendingAnim.from);
    pendingAnim = null;
  }
  if (animateDistribution) {
    animateDistribution = false;
    requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll('.op-bar i').forEach((i) => { i.style.width = `${i.dataset.w}%`; })));
  }
}
