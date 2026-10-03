// Warstwa usług: REAL PROVIDER → SERVICE LAYER → MOCK PROVIDER.
// Demo nigdy nie zależy od dostawcy zewnętrznego — każde wywołanie ma fallback.

import { analyzeAlert } from './analyzer.js';

export async function loadDataset() {
  const res = await fetch('/data/demo-events.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Nie można wczytać danych demonstracyjnych (${res.status})`);
  return res.json();
}

let health = null;

/** Sprawdza, czy serwer udostępnia dostawcę LLM (opcjonalny, doradczy). */
export async function providerStatus() {
  if (health) return health;
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    health = res.ok ? await res.json() : { llm: false, provider: 'mock' };
  } catch {
    health = { llm: false, provider: 'mock' };
  }
  return health;
}

/**
 * Analiza jakości komunikatu.
 * Wynik i decyzja o blokadzie pochodzą ZAWSZE z deterministycznego silnika regułowego
 * (powtarzalność i audytowalność). LLM — jeśli dostępny — dodaje wyłącznie opinię doradczą.
 */
export async function analyze(text, ctx) {
  const rules = analyzeAlert(text, ctx);
  const status = await providerStatus();
  if (!status.llm) return { ...rules, advisory: null };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, validUntil: ctx.validUntil, areas: ctx.selectedAreaIds }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    return { ...rules, advisory: await res.json() };
  } catch {
    return { ...rules, advisory: { unavailable: true } };
  }
}
