// Bounded retry for transient AI provider failures (shared by Groq and Gemini).
export class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs?: number) {
    super(message);
  }
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500; // 500ms, 1000ms (+ jitter)
const MAX_DELAY_MS = 5_000; // cap on any single wait, including Retry-After
const TOTAL_BUDGET_MS = 40_000; // keeps total time under the eval harness' 45s hard timeout
const ATTEMPT_TIMEOUT_MS = 30_000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// Retry-After is either delta-seconds or an HTTP date.
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

function status(err: unknown): number | undefined {
  const s = (err as { status?: unknown })?.status;
  return typeof s === "number" ? s : undefined;
}

// A numeric status must be in RETRYABLE; no status means network failure or timeout.
function isTransient(err: unknown): boolean {
  const s = status(err);
  return s === undefined || RETRYABLE.has(s);
}

function reason(err: unknown): string {
  return status(err)?.toString() ?? ((err as Error)?.name === "TimeoutError" ? "timeout" : "network");
}

export interface RetryOptions {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** `fn` gets the per-attempt timeout (ms), already clamped to the remaining total budget. */
export async function withRetry<T>(
  provider: string,
  fn: (timeoutMs: number) => Promise<T>,
  { sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now }: RetryOptions = {},
): Promise<T> {
  const start = now();
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(Math.min(ATTEMPT_TIMEOUT_MS, TOTAL_BUDGET_MS - (now() - start)));
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isTransient(err)) throw err;
      const hinted = err instanceof HttpError && status(err) === 429 ? err.retryAfterMs : undefined;
      const delay = Math.min(hinted ?? BASE_DELAY_MS * 2 ** (attempt - 1) * (1 + Math.random() * 0.2), MAX_DELAY_MS);
      if (now() - start + delay >= TOTAL_BUDGET_MS) throw err; // no time left for another attempt
      console.warn(`[ai] retry provider=${provider} attempt=${attempt + 1}/${MAX_ATTEMPTS} reason=${reason(err)} delayMs=${Math.round(delay)}`);
      await sleep(delay);
    }
  }
}
