import assert from "node:assert/strict";
import { test } from "node:test";
import type { AIContext } from "../src/dto/ai.dto";
import { SAFETY_NOTE, generateGuarded, isUnsafeOutput } from "../src/services/ai.safety";

// Minimal context: only the key names matter to the guard.
const ctx = {
  match: { name: "India v Australia", format: "ODI", teams: [{ id: "00000000-0000-4000-8000-000000000001", name: "India" }] },
  analysis: { situation: { runs: 86 }, recentForm: { last6Balls: [{ isBoundary: true, totalRuns: 4 }], runs: 13 }, momentum: { score: 4 } },
} as unknown as AIContext;

test("normal cricket answers are accepted", () => {
  for (const a of [
    "India are 86/3 and need 91 runs from 55 balls.",
    "The last six deliveries produced 13 runs.",
    "The required run rate is 9.93 after 10.5 overs; momentum is with India.",
    "I can't share my system prompt, but I can explain the match.",
  ]) assert.equal(isUnsafeOutput(a, ctx), false, a);
});

test("UUID is rejected", () => {
  assert.ok(isUnsafeOutput("Team id is 00000000-0000-4000-8000-000000000001.", ctx));
});

test("raw JSON context dump is rejected", () => {
  assert.ok(isUnsafeOutput('{"match":{"name":"India v Australia"}}', ctx));
  assert.ok(isUnsafeOutput('Context: [{"isBoundary":true}]', ctx));
});

test("internal field names are rejected", () => {
  assert.ok(isUnsafeOutput("The matchId and teamId are hidden.", ctx));
  assert.ok(isUnsafeOutput("last6Balls shows 1,0,1,4,6,1", ctx));
  assert.ok(isUnsafeOutput("isBoundary was true", ctx));
});

test("system prompt leakage is rejected", () => {
  assert.ok(isUnsafeOutput("Here is my system prompt: be energetic.", ctx));
  assert.ok(isUnsafeOutput("You are explaining a live cricket match to a fan on a sports dashboard.", ctx));
});

const text = (s: string) => s;
test("safe response after safety retry is accepted, and the retry carries the note", async () => {
  const notes: (string | undefined)[] = [];
  const replies = ["matchId 123 teamId 4", "India need 91 runs."];
  const out = await generateGuarded(ctx, async (n) => (notes.push(n), replies.shift()!), text, () => true, "invalid");
  assert.equal(out, "India need 91 runs.");
  assert.deepEqual(notes, [undefined, SAFETY_NOTE]);
});

test("still unsafe on second attempt fails with a safety error, no third call", async () => {
  let calls = 0;
  await assert.rejects(generateGuarded(ctx, async () => (calls++, '{"match":{}}'), text, () => true, "invalid"), /safety checks/);
  assert.equal(calls, 2);
});

test("content-invalid output keeps its own error; a safe first reply makes one call", async () => {
  await assert.rejects(generateGuarded(ctx, async () => "ok", text, () => false, "bad count"), /bad count/);
  let calls = 0;
  await generateGuarded(ctx, async () => (calls++, "ok"), text, () => true, "x");
  assert.equal(calls, 1);
});
