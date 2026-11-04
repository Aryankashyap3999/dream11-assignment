import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { rateLimit } from "../src/middleware/rate-limit";

function call(limiter: ReturnType<typeof rateLimit>, ip: string) {
  const out = { status: 0, headers: {} as Record<string, string>, next: false };
  const res = {
    set: (k: string, v: string) => ((out.headers[k] = v), res),
    status: (s: number) => ((out.status = s), res),
    json: () => res,
  } as unknown as Response;
  limiter({ ip } as Request, res, () => (out.next = true));
  return out;
}

test("allows up to max per IP, then 429 with Retry-After", () => {
  const limiter = rateLimit(2, 60_000, () => 1000);
  assert.equal(call(limiter, "1.1.1.1").next, true);
  assert.equal(call(limiter, "1.1.1.1").next, true);
  const blocked = call(limiter, "1.1.1.1");
  assert.equal(blocked.next, false);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers["Retry-After"], "60");
  assert.equal(call(limiter, "2.2.2.2").next, true); // other IPs unaffected
});

test("window resets after windowMs", () => {
  let t = 0;
  const limiter = rateLimit(1, 1000, () => t);
  assert.equal(call(limiter, "a").next, true);
  assert.equal(call(limiter, "a").next, false);
  t = 1000;
  assert.equal(call(limiter, "a").next, true);
});
