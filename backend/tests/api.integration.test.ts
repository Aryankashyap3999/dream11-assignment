// Integration tests against the seeded demo match (npm run db:seed) on the local Postgres.
// Skipped when the database is unreachable or not seeded. They move the demo replay position, and put it back
// to "no session" (everything visible) when done.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";
import express from "express";

process.env.REPLAY_INTERVAL_MS = "20"; // read once at import of replay.service
const MATCH = "00000000-0000-4000-8000-000200000000";
const INDIA = "00000000-0000-4000-8000-001000000000";

let skip: string | false = false;
const { db } = await import("../src/prisma/db");
try {
  await db.connect();
  if (!(await db.orm.public.Match.first({ id: MATCH }))) skip = "demo match not seeded (npm run db:seed)";
} catch {
  skip = "database not reachable";
}

const { default: apiRouter } = await import("../src/routes/index");
const app = express();
app.use(express.json());
app.use("/api", apiRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

const get = async (path: string) => {
  const r = await fetch(base + path);
  return { status: r.status, body: (await r.json()) as any };
};
const post = async (path: string) => {
  const r = await fetch(base + path, { method: "POST" });
  return { status: r.status, body: (await r.json()) as any };
};
const clearSession = () => db.orm.public.DemoSession.where({ matchId: MATCH }).delete();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

after(async () => {
  if (!skip) {
    await post(`/demo/${MATCH}/pause`);
    await clearSession();
    await db.close();
  }
  server.close();
});

test("match list, detail and scorecard", { skip }, async () => {
  await clearSession();
  const list = await get("/matches");
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((m: { id: string }) => m.id === MATCH));

  const detail = await get(`/matches/${MATCH}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.data.teams.map((t: { name: string }) => t.name).sort(), ["Australia", "India"]);

  const card = await get(`/matches/${MATCH}/scorecard`);
  const totals = Object.fromEntries(card.body.data.totals.map((t: { teamName: string }) => [t.teamName, t]));
  assert.deepEqual([totals.Australia.runs, totals.Australia.wickets], [176, 4]);
  assert.deepEqual([totals.India.runs, totals.India.wickets, totals.India.balls], [86, 3, 65]);
});

test("invalid and unknown match ids", { skip }, async () => {
  assert.equal((await get("/matches/not-a-uuid")).status, 400);
  assert.equal((await get("/matches/00000000-0000-4000-8000-0000000000ff")).status, 404);
  assert.equal((await get("/analysis/not-a-uuid")).status, 400);
  assert.equal((await post("/demo/00000000-0000-4000-8000-0000000000ff/start")).status, 404);
});

test("analysis calculations on the full chase", { skip }, async () => {
  await clearSession();
  const { status, body } = await get(`/analysis/${MATCH}`);
  assert.equal(status, 200);
  const s = body.data.situation;
  assert.deepEqual(
    [s.teamId, s.runs, s.wickets, s.balls, s.runsRequired, s.ballsRemaining, s.requiredRunRate],
    [INDIA, 86, 3, 65, 91, 55, 9.93], // chasing 177: 177 - 86 = 91, 120 - 65 = 55, 91 / 55 * 6 = 9.93
  );
  assert.equal(body.data.recentForm.last6Balls.length, 6);
  assert.equal(body.data.recentForm.runs, 13);
  assert.equal(body.data.momentum.direction, "POSITIVE");
});

test("replay visibility: nothing after the current position leaks into analysis or scorecard", { skip }, async () => {
  await post(`/demo/${MATCH}/reset`);
  const session = await db.orm.public.DemoSession.where({ matchId: MATCH }).first();
  assert.ok(session);

  // Replay paused at sequence 150: India 33/1 after 26 balls, 144 needed off 94.
  await db.orm.public.DemoSession.where({ id: session.id }).update({ currentSequence: 150n });
  const a = (await get(`/analysis/${MATCH}`)).body.data.situation;
  assert.deepEqual([a.runs, a.wickets, a.balls, a.runsRequired, a.ballsRemaining, a.requiredRunRate], [33, 1, 26, 144, 94, 9.19]);

  const card = (await get(`/matches/${MATCH}/scorecard`)).body.data;
  const india = card.totals.find((t: { teamId: string }) => t.teamId === INDIA);
  assert.deepEqual([india.runs, india.wickets, india.balls], [33, 1, 26]);
  const batted = card.batting.filter((b: { playerId: string }) => b.playerId.startsWith("00000000-0000-4000-8000-0100000000"));
  assert.ok(batted.reduce((n: number, b: { runs: number }) => n + b.runs, 0) <= 33 + 176, "no India runs beyond sequence 150");

  // Back at the very start: only the first delivery is visible.
  await post(`/demo/${MATCH}/reset`);
  const first = (await get(`/analysis/${MATCH}`)).body.data.situation;
  assert.deepEqual([first.runs, first.wickets, first.balls], [1, 0, 1]);
});

test("replay start, pause and reset", { skip }, async () => {
  const reset = await post(`/demo/${MATCH}/reset`);
  assert.equal(reset.body.data.status, "PAUSED");
  const first = reset.body.data.currentSequence;
  assert.equal(typeof first, "number");

  assert.equal((await post(`/demo/${MATCH}/start`)).body.data.status, "RUNNING");
  let moved = first;
  for (let i = 0; i < 100 && moved === first; i++) {
    await sleep(30);
    moved = (await get(`/demo/${MATCH}`)).body.data.currentSequence;
  }
  assert.ok(moved > first, "position advances while running");

  const paused = await post(`/demo/${MATCH}/pause`);
  assert.equal(paused.body.data.status, "PAUSED");
  await sleep(100);
  const frozen = (await get(`/demo/${MATCH}`)).body.data;
  assert.equal(frozen.status, "PAUSED");
  assert.equal(frozen.currentSequence, paused.body.data.currentSequence, "position stays put while paused");

  const again = await post(`/demo/${MATCH}/reset`);
  assert.equal(again.body.data.currentSequence, first);
  assert.equal(again.body.data.status, "PAUSED");
});
