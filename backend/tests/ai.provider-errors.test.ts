import assert from "node:assert/strict";
import test from "node:test";
import { HttpError, isProviderUnavailable } from "../src/ai/retry";

test("quota, 5xx, timeout and network failures are provider-unavailable", () => {
  for (const s of [429, 500, 502, 503, 504]) assert.equal(isProviderUnavailable(new HttpError("x", s)), true, String(s));
  assert.equal(isProviderUnavailable(Object.assign(new Error("t"), { name: "TimeoutError" })), true);
  assert.equal(isProviderUnavailable(Object.assign(new Error("t"), { name: "AbortError" })), true);
  assert.equal(isProviderUnavailable(new TypeError("fetch failed")), true);
});

test("auth errors and our own failures stay internal errors", () => {
  assert.equal(isProviderUnavailable(new HttpError("x", 401)), false);
  assert.equal(isProviderUnavailable(new HttpError("x", 400)), false);
  assert.equal(isProviderUnavailable(new Error("AI output failed safety checks after retry")), false);
  assert.equal(isProviderUnavailable(new SyntaxError("Unexpected token")), false);
  assert.equal(isProviderUnavailable(undefined), false);
});
