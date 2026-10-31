import { db } from "../prisma/db";

/**
 * Replay engine: moves DemoSession.currentSequence forward one delivery at a time.
 * It never touches match data; analysis/match services use visibleSequence() as the
 * "what has happened so far" boundary.
 *
 * ponytail: the timer map is in-process, so this is single-instance only. With several
 * backend instances, replace it with a distributed lock (Redis) or a single worker.
 */
const INTERVAL_MS = Number(process.env.REPLAY_INTERVAL_MS) || 2000;
const timers = new Map<string, NodeJS.Timeout>();

const sessions = db.orm.public.DemoSession;

export class ReplayConflictError extends Error {}

export interface ReplayState {
  matchId: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
  currentSequence: number | null;
  nextSequence: number | null;
}

/** Live visibility boundary: events with sequenceNumber <= this have happened. null = no session, show everything. */
export async function visibleSequence(matchId: string): Promise<number | null> {
  const s = await sessions.where({ matchId }).first();
  return s ? Number(s.currentSequence) : null;
}

// Sequence numbers of real cricket deliveries only, ascending.
async function deliverySequences(matchId: string): Promise<number[]> {
  const events = await db.orm.public.MatchEvent.where({ matchId }).include("cricketDelivery").all();
  return events
    .filter((e) => e.cricketDelivery)
    .map((e) => Number(e.sequenceNumber))
    .sort((a, b) => a - b);
}

async function matchExists(matchId: string) {
  return (await db.orm.public.Match.first({ id: matchId })) !== null;
}

async function getOrCreate(matchId: string) {
  return (await sessions.where({ matchId }).first()) ?? (await sessions.create({ matchId }));
}

function toState(
  matchId: string,
  status: ReplayState["status"],
  currentSequence: number | null,
  seqs: number[],
): ReplayState {
  const nextSequence = currentSequence === null ? null : (seqs.find((s) => s > currentSequence) ?? null);
  return { matchId, status, currentSequence, nextSequence };
}

export async function getReplayState(matchId: string): Promise<ReplayState | null> {
  if (!(await matchExists(matchId))) return null;
  const s = await sessions.where({ matchId }).first();
  const seqs = await deliverySequences(matchId);
  if (!s) return toState(matchId, "IDLE", null, seqs);
  // a RUNNING row without a live timer (e.g. server restarted) is really paused
  const status = s.status === "RUNNING" && !timers.has(matchId) ? "PAUSED" : (s.status as ReplayState["status"]);
  return toState(matchId, status, Number(s.currentSequence), seqs);
}

// One step: expose the next delivery, or mark COMPLETED when there is none left.
async function advance(matchId: string): Promise<ReplayState> {
  const s = await getOrCreate(matchId);
  const seqs = await deliverySequences(matchId);
  const next = seqs.find((n) => n > Number(s.currentSequence));
  const current = next ?? Number(s.currentSequence);
  const done = next === undefined || next === seqs.at(-1);
  await sessions.where({ id: s.id }).update({
    currentSequence: BigInt(current),
    ...(done ? { status: "COMPLETED" } : {}),
    updatedAt: new Date(),
  });
  return toState(matchId, done ? "COMPLETED" : "RUNNING", current, seqs);
}

function schedule(matchId: string) {
  clearTimeout(timers.get(matchId)); // concurrent starts must never leave two loops
  timers.set(
    matchId,
    setTimeout(async () => {
      try {
        const state = await advance(matchId);
        if (state.status !== "RUNNING" || !timers.has(matchId)) return void timers.delete(matchId);
        schedule(matchId);
      } catch (error) {
        console.error("Replay tick failed", error);
        timers.delete(matchId);
      }
    }, INTERVAL_MS),
  );
}

function stop(matchId: string) {
  clearTimeout(timers.get(matchId));
  timers.delete(matchId);
}

export async function startReplay(matchId: string): Promise<ReplayState | null> {
  if (!(await matchExists(matchId))) return null;
  if (timers.has(matchId)) return getReplayState(matchId); // already running: one loop per match
  const s = await getOrCreate(matchId);
  if (s.status === "COMPLETED") throw new ReplayConflictError("Replay completed; reset it first");
  const seqs = await deliverySequences(matchId);
  if (!seqs.length) throw new ReplayConflictError("Match has no deliveries to replay");
  await sessions.where({ id: s.id }).update({ status: "RUNNING", startedAt: s.startedAt ?? new Date(), updatedAt: new Date() });
  schedule(matchId);
  return toState(matchId, "RUNNING", Number(s.currentSequence), seqs);
}

export async function pauseReplay(matchId: string): Promise<ReplayState | null> {
  if (!(await matchExists(matchId))) return null;
  stop(matchId);
  const s = await sessions.where({ matchId }).first();
  if (s && s.status === "RUNNING") {
    await sessions.where({ id: s.id }).update({ status: "PAUSED", updatedAt: new Date() });
  }
  return getReplayState(matchId);
}

// Back to the first delivery (taken from the data), paused.
export async function resetReplay(matchId: string): Promise<ReplayState | null> {
  if (!(await matchExists(matchId))) return null;
  stop(matchId);
  const s = await getOrCreate(matchId);
  const seqs = await deliverySequences(matchId);
  await sessions.where({ id: s.id }).update({
    currentSequence: BigInt(seqs[0] ?? 0),
    status: "PAUSED",
    startedAt: null,
    updatedAt: new Date(),
  });
  return getReplayState(matchId);
}
