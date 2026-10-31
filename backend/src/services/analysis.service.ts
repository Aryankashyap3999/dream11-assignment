import { db } from "../prisma/db";
import type {
  AnalysisResponse,
  KeyMoment,
  Momentum,
  PlayerToWatch,
  RecentForm,
} from "../dto/analysis.dto";

const WINDOW = 6;
// ponytail: wicket/boundary weights are tunable constants, not a statistical model
const WICKET_WEIGHT = 10; // a wicket is worth this many runs when comparing windows
const MOMENTUM_SCALE = 4; // score points per run of difference
const MOMENTUM_THRESHOLD = 10; // |score| below this is NEUTRAL
const IMPACT = { WICKET: 80, SIX: 60, FOUR: 40 };

const eventsQuery = () =>
  db.orm.public.MatchEvent.include("cricketDelivery").include("cricketWicket");
type Event = Awaited<ReturnType<ReturnType<typeof eventsQuery>["all"]>>[number];
type Delivery = Event & { cricketDelivery: NonNullable<Event["cricketDelivery"]> };

const hasDelivery = (e: Event): e is Delivery => e.cricketDelivery !== null;
const seq = (e: Event) => Number(e.sequenceNumber);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// wides and no-balls are not legal deliveries; byes/leg-byes are.
export function isLegalBall(extraType: string | null) {
  const t = (extraType ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return !["wide", "wd", "noball", "nb"].includes(t);
}
const isLegal = (d: Delivery) => isLegalBall(d.cricketDelivery.extraType);

// Max balls per innings for known limited-overs formats only.
function maxBalls(format: string | null): number | null {
  const f = (format ?? "").toLowerCase();
  if (f.includes("t20")) return 120;
  if (f.includes("odi")) return 300;
  return null;
}

/**
 * Momentum compares the latest 6 deliveries with the 6 before them.
 * window value = runs - WICKET_WEIGHT * wickets
 * score = clamp((recent - previous) * MOMENTUM_SCALE, -100, 100)
 * Without a previous window there is nothing to compare, so score is 0.
 */
function momentum(balls: Delivery[]): Momentum {
  const value = (w: Delivery[]) =>
    sum(w.map((b) => b.cricketDelivery.totalRuns)) -
    WICKET_WEIGHT * w.filter((b) => b.cricketWicket).length;
  const recent = balls.slice(-WINDOW);
  const previous = balls.slice(-2 * WINDOW, -WINDOW);
  const raw = previous.length ? (value(recent) - value(previous)) * MOMENTUM_SCALE : 0;
  const score = Math.max(-100, Math.min(100, Math.round(raw)));
  const direction =
    score > MOMENTUM_THRESHOLD ? "POSITIVE" : score < -MOMENTUM_THRESHOLD ? "NEGATIVE" : "NEUTRAL";
  return { score, direction };
}

function recentForm(balls: Delivery[]): RecentForm {
  const last = balls.slice(-WINDOW).map((b) => ({
    runs: b.cricketDelivery.batterRuns,
    totalRuns: b.cricketDelivery.totalRuns,
    isBoundary: b.cricketDelivery.isBoundary,
    isWicket: b.cricketWicket !== null,
  }));
  return {
    last6Balls: last,
    runs: sum(last.map((b) => b.totalRuns)),
    wickets: last.filter((b) => b.isWicket).length,
    boundaries: last.filter((b) => b.isBoundary).length,
  };
}

// Obvious events only: wickets, sixes, fours.
function detectMoments(balls: Delivery[]): KeyMoment[] {
  const moments: KeyMoment[] = [];
  for (const b of balls) {
    const d = b.cricketDelivery;
    const over = `${d.overNumber}.${d.ballNumber}`;
    if (b.cricketWicket) {
      moments.push({ eventId: b.id, type: "WICKET", title: "Wicket", impactScore: IMPACT.WICKET,
        description: `${b.cricketWicket.wicketType} at ${over}` });
    } else if (d.isBoundary && d.batterRuns >= 6) {
      moments.push({ eventId: b.id, type: "SIX", title: "Six", impactScore: IMPACT.SIX,
        description: `Six at ${over}` });
    } else if (d.isBoundary) {
      moments.push({ eventId: b.id, type: "FOUR", title: "Four", impactScore: IMPACT.FOUR,
        description: `Four at ${over}` });
    }
  }
  return moments.slice(-5);
}

async function keyMoments(matchId: string, balls: Delivery[]): Promise<KeyMoment[]> {
  const rows = await db.orm.public.KeyMoment.where({ matchId }).all();
  if (!rows.length) return detectMoments(balls);
  return rows
    .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
    .slice(0, 5)
    .map((k) => ({
      eventId: k.eventId,
      type: k.momentType,
      title: k.title ?? k.momentType,
      description: k.description,
      impactScore: k.impactScore === null ? null : Number(k.impactScore),
    }));
}

// Points over the last 12 deliveries: batter runs (+2 per boundary), 20 per bowler wicket.
async function playerToWatch(matchId: string, balls: Delivery[]): Promise<PlayerToWatch | null> {
  const points = new Map<string, { pts: number; runs: number; wickets: number }>();
  const add = (id: string, pts: number, runs: number, wickets: number) => {
    const p = points.get(id) ?? { pts: 0, runs: 0, wickets: 0 };
    points.set(id, { pts: p.pts + pts, runs: p.runs + runs, wickets: p.wickets + wickets });
  };
  for (const b of balls.slice(-2 * WINDOW)) {
    const d = b.cricketDelivery;
    add(d.batterId, d.batterRuns + (d.isBoundary ? 2 : 0), d.batterRuns, 0);
    if (b.cricketWicket && b.cricketWicket.wicketType.toLowerCase().replace(/[^a-z]/g, "") !== "runout") {
      add(d.bowlerId, 20, 0, 1);
    }
  }
  // strict > keeps the earliest-seen player on ties, so the pick is deterministic
  let best: [string, { pts: number; runs: number; wickets: number }] | null = null;
  for (const entry of points) if (entry[1].pts > (best?.[1].pts ?? 0)) best = entry;
  if (!best) return null;

  const [playerId, s] = best;
  const mp = await db.orm.public.MatchPlayer.where({ matchId, playerId }).include("player").first();
  if (!mp) return null;
  return {
    playerId,
    name: mp.player.displayName ?? mp.player.name,
    teamId: mp.teamId,
    role: mp.role,
    reason: s.wickets
      ? `${s.wickets} wicket(s) and ${s.runs} runs off the bat in the last ${2 * WINDOW} balls`
      : `${s.runs} runs off the bat in the last ${2 * WINDOW} balls`,
  };
}

export async function getMatchAnalysis(matchId: string): Promise<AnalysisResponse | null> {
  const match = await db.orm.public.Match.first({ id: matchId });
  if (!match) return null;

  const events = (await eventsQuery().where({ matchId }).all()).sort((a, b) => seq(a) - seq(b));
  const allBalls = events.filter(hasDelivery);
  const latest = allBalls.at(-1);

  // Current innings = the period of the latest delivery.
  const periodId = latest?.periodId ?? null;
  const inningsEvents = events.filter((e) => e.periodId === periodId);
  const balls = inningsEvents.filter(hasDelivery);

  const runs = sum(balls.map((b) => b.cricketDelivery.totalRuns));
  const wickets = inningsEvents.filter((e) => e.cricketWicket).length;
  const legalBalls = balls.filter(isLegal).length;

  // Chase only when a previous innings with deliveries exists in a known limited-overs format.
  const max = maxBalls(match.format);
  let runsRequired: number | null = null;
  if (latest && periodId && max !== null) {
    const periods = await db.orm.public.MatchPeriod.where({ matchId }).all();
    const current = periods.find((p) => p.id === periodId);
    const prior = periods
      .filter((p) => current && p.periodNumber < current.periodNumber)
      .sort((a, b) => b.periodNumber - a.periodNumber)
      .find((p) => allBalls.some((b) => b.periodId === p.id));
    if (prior) {
      const target = sum(allBalls.filter((b) => b.periodId === prior.id).map((b) => b.cricketDelivery.totalRuns)) + 1;
      runsRequired = Math.max(target - runs, 0);
    }
  }
  const ballsRemaining = latest && max !== null ? Math.max(max - legalBalls, 0) : null;
  const requiredRunRate =
    runsRequired !== null && ballsRemaining
      ? Math.round((runsRequired / (ballsRemaining / 6)) * 100) / 100
      : null;

  return {
    matchId,
    situation: {
      teamId: latest?.teamId ?? null,
      runs,
      wickets,
      balls: legalBalls,
      runsRequired,
      ballsRemaining,
      requiredRunRate,
    },
    recentForm: recentForm(balls),
    momentum: momentum(balls),
    keyMoments: await keyMoments(matchId, balls),
    playerToWatch: await playerToWatch(matchId, balls),
  };
}
