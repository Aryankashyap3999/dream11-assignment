import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLiveContext } from "../src/services/ai.context";
import type { ScoreEvent } from "../src/services/match.service";

const names = new Map([["a", "Aarav Sharma"], ["v", "Vikram Rao"], ["j", "Jack Holloway"], ["f", "Sam Fielder"]]);
let n = 0;
const ball = (batterId: string, batterRuns: number, extra: Partial<{ wicket: object; isBoundary: boolean }> = {}) =>
  ({
    id: `e${++n}`, periodId: "p1", sequenceNumber: BigInt(n), team: { name: "India" },
    cricketDelivery: { overNumber: 0, ballNumber: n, batterId, bowlerId: "j", totalRuns: batterRuns, batterRuns, extraType: null, isBoundary: extra.isBoundary ?? false },
    cricketWicket: extra.wicket ?? null,
  }) as unknown as ScoreEvent;

const events = [
  ball("a", 4, { isBoundary: true }),
  ball("a", 2),
  ball("v", 0, { wicket: { playerId: "v", wicketType: "caught", fielderId: "f" } }),
  ball("a", 6, { isBoundary: true }), // "future" ball
];

test("current batter/bowler stats and latest wicket come from visible events", () => {
  const live = buildLiveContext(events.slice(0, 3), names);
  assert.equal(live.batter?.name, "Vikram Rao");
  assert.equal(live.bowler?.name, "Jack Holloway");
  assert.equal(live.bowler?.wickets, 1);
  assert.equal(live.latestEvent?.type, "WICKET");
  assert.deepEqual(live.latestEvent?.dismissal, { batterOut: "Vikram Rao", how: "caught", fielder: "Sam Fielder" });
});

test("replay paused earlier does not expose the later six", () => {
  const paused = buildLiveContext(events.slice(0, 2), names);
  assert.equal(paused.latestEvent?.type, "RUNS");
  assert.deepEqual(paused.batter, { name: "Aarav Sharma", runs: 6, balls: 2, fours: 1, sixes: 0 });
  assert.equal(buildLiveContext(events, names).batter?.sixes, 1); // full match does include it
});

test("no deliveries gives nulls", () => {
  assert.deepEqual(buildLiveContext([], names), { batter: null, bowler: null, latestEvent: null });
});
