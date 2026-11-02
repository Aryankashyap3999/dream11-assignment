// Eval-only pacing between LLM calls, to stay under provider rate limits. Not a retry; production retry is unchanged.
export const DEFAULT_DELAY_MS = 4000;

export function parseDelayMs(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_DELAY_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`EVAL_DELAY_MS must be a non-negative number of milliseconds, got "${raw}"`);
  return n;
}

// Returns a function to await before each LLM call: no wait before the first, `delayMs` after the previous one finished.
export function makePacer(delayMs: number, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {
  let called = false;
  return async () => {
    if (called && delayMs > 0) await sleep(delayMs);
    called = true;
  };
}
