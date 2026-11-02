import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError, parseRetryAfter, withRetry } from "../src/ai/retry";

const setup = () => {
  const delays: number[] = [];
  let calls = 0;
  return { delays, opts: { sleep: async (ms: number) => void delays.push(ms) }, calls: () => calls, tick: () => ++calls };
};
const timeoutErr = () => Object.assign(new Error("timed out"), { name: "TimeoutError" });

for (const [label, mk] of [
  ["429", () => new HttpError("x", 429)],
  ["503", () => new HttpError("x", 503)],
  ["network failure", () => new TypeError("fetch failed")],
  ["timeout", timeoutErr],
] as const) {
  test(`${label} retries then succeeds`, async () => {
    const s = setup();
    const out = await withRetry("t", async () => { if (s.tick() < 3) throw mk(); return "ok"; }, s.opts);
    assert.equal(out, "ok");
    assert.equal(s.calls(), 3);
    assert.ok(s.delays[0] >= 500 && s.delays[0] <= 600 && s.delays[1] >= 1000 && s.delays[1] <= 1200);
  });
}

test("400 is not retried", async () => {
  const s = setup();
  await assert.rejects(withRetry("t", async () => { s.tick(); throw new HttpError("bad", 400); }, s.opts), /bad/);
  assert.equal(s.calls(), 1);
});

test("success makes one call and no sleep", async () => {
  const s = setup();
  await withRetry("t", async () => s.tick(), s.opts);
  assert.equal(s.calls(), 1);
  assert.deepEqual(s.delays, []);
});

test("exhausted retries rethrow the provider error", async () => {
  const s = setup();
  await assert.rejects(withRetry("t", async () => { s.tick(); throw new HttpError("down", 503); }, s.opts), (e: HttpError) => e.status === 503);
  assert.equal(s.calls(), 3);
});

test("Retry-After is respected and capped", async () => {
  const s = setup();
  await withRetry("t", async () => { if (s.tick() === 1) throw new HttpError("rl", 429, 2000); return 1; }, s.opts);
  assert.deepEqual(s.delays, [2000]);
  const c = setup();
  await withRetry("t", async () => { if (c.tick() === 1) throw new HttpError("rl", 429, 600_000); return 1; }, c.opts);
  assert.deepEqual(c.delays, [5000]);
  assert.equal(parseRetryAfter("abc"), undefined);
  assert.equal(parseRetryAfter("-3"), undefined);
  assert.equal(parseRetryAfter("2"), 2000);
});

test("total budget stops retries", async () => {
  let t = 0;
  let calls = 0;
  await assert.rejects(withRetry("t", async () => { calls++; t += 39_700; throw timeoutErr(); }, { sleep: async () => {}, now: () => t }));
  assert.equal(calls, 1);
});
