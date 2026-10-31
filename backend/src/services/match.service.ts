import { db } from "../prisma/db";
import { isLegalBall } from "./analysis.service";
import { visibleSequence } from "./replay.service";
import type {
  BattingEntry,
  FieldingEntry,
  MatchDetails,
  MatchListItem,
  MatchScorecard,
  TeamTotal,
} from "../dto/match.dto";

const matches = db.orm.public.Match;

function matchWithRelations() {
  return matches
    .include("sport")
    .include("teams", (mt) => mt.include("team"));
}

type MatchRow = Awaited<ReturnType<ReturnType<typeof matchWithRelations>["all"]>>[number];

function toListItem(m: MatchRow): MatchListItem {
  return {
    id: m.id,
    name: m.name,
    format: m.format,
    status: m.status,
    venue: m.venue,
    startTime: m.startTime,
    endTime: m.endTime,
    lastUpdatedAt: m.lastUpdatedAt,
    sport: { code: m.sport.code, name: m.sport.name },
    teams: m.teams.map((mt) => ({
      id: mt.team.id,
      name: mt.team.name,
      shortName: mt.team.shortName,
      logoUrl: mt.team.logoUrl,
      role: mt.role,
    })),
  };
}

export async function getMatches(): Promise<MatchListItem[]> {
  const rows = await matchWithRelations()
    .orderBy((m) => m.startTime.desc())
    .all();
  return rows.map(toListItem);
}

export async function getMatchById(matchId: string): Promise<MatchDetails | null> {
  const match = await matchWithRelations().where({ id: matchId }).first();
  if (!match) return null;

  const players = await db.orm.public.MatchPlayer.where({ matchId })
    .include("player")
    .all();

  return {
    ...toListItem(match),
    players: players.map((mp) => ({
      id: mp.player.id,
      name: mp.player.displayName ?? mp.player.name,
      teamId: mp.teamId,
      role: mp.role,
      isStarting: mp.isStarting,
    })),
  };
}

const norm = (t: string | null) => (t ?? "").toLowerCase().replace(/[^a-z]/g, "");

type ScoreEvent = Awaited<ReturnType<typeof visibleEvents>>["list"][number];

// Events that have happened so far: all of them, or only up to the replay position.
async function visibleEvents(matchId: string) {
  const visible = await visibleSequence(matchId);
  const events = await db.orm.public.MatchEvent.where({ matchId })
    .include("team")
    .include("cricketDelivery")
    .include("cricketWicket")
    .all();
  return {
    replaying: visible !== null,
    list: events
      .filter((e) => visible === null || Number(e.sequenceNumber) <= visible)
      .sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)),
  };
}

function teamTotals(events: ScoreEvent[]): TeamTotal[] {
  const totals = new Map<string, TeamTotal>();
  for (const e of events) {
    if (!e.team || (!e.cricketDelivery && !e.cricketWicket)) continue;
    const t = totals.get(e.team.id) ?? {
      teamId: e.team.id,
      teamName: e.team.name,
      runs: 0,
      wickets: 0,
      balls: 0,
    };
    if (e.cricketDelivery) {
      t.runs += e.cricketDelivery.totalRuns;
      if (isLegalBall(e.cricketDelivery.extraType)) t.balls += 1;
    }
    if (e.cricketWicket) t.wickets += 1;
    totals.set(t.teamId, t);
  }
  return [...totals.values()];
}

// Replay mode: player stats rebuilt from the visible deliveries instead of the final precomputed rows.
function replayPlayerStats(events: ScoreEvent[], names: Map<string, string>) {
  const name = (id: string) => names.get(id) ?? id;
  const bat = new Map<string, BattingEntry>();
  const bowl = new Map<string, { legal: number; runs: number; wickets: number; maidens: number }>();
  const over = new Map<string, { bowlerId: string; legal: number; runs: number }>();
  const field = new Map<string, FieldingEntry>();
  const batter = (id: string) => {
    if (!bat.has(id)) {
      bat.set(id, { playerId: id, playerName: name(id), runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissalType: null });
    }
    return bat.get(id)!;
  };

  for (const e of events) {
    const d = e.cricketDelivery;
    if (d) {
      const legal = isLegalBall(d.extraType);
      const b = batter(d.batterId);
      b.runs += d.batterRuns;
      if (legal) b.balls += 1;
      if (d.isBoundary && d.batterRuns === 4) b.fours += 1;
      if (d.isBoundary && d.batterRuns === 6) b.sixes += 1;

      // wides/no-balls are charged to the bowler; byes/leg-byes are not
      const charged = legal ? d.batterRuns : d.totalRuns;
      const o = bowl.get(d.bowlerId) ?? { legal: 0, runs: 0, wickets: 0, maidens: 0 };
      o.runs += charged;
      if (legal) o.legal += 1;
      bowl.set(d.bowlerId, o);

      const key = `${e.periodId}:${d.overNumber}:${d.bowlerId}`;
      const ov = over.get(key) ?? { bowlerId: d.bowlerId, legal: 0, runs: 0 };
      ov.runs += charged;
      if (legal) ov.legal += 1;
      over.set(key, ov);
    }
    const w = e.cricketWicket;
    if (w) {
      batter(w.playerId).dismissalType = w.wicketType;
      const type = norm(w.wicketType);
      if (d && type !== "runout") bowl.get(d.bowlerId)!.wickets += 1;
      if (w.fielderId) {
        const f = field.get(w.fielderId) ?? { playerId: w.fielderId, playerName: name(w.fielderId), catches: 0, runOuts: 0, stumpings: 0, missedCatches: 0 };
        if (type === "caught") f.catches += 1;
        else if (type === "runout") f.runOuts += 1;
        else if (type === "stumped") f.stumpings += 1;
        field.set(w.fielderId, f);
      }
    }
  }
  for (const ov of over.values()) if (ov.legal === 6 && ov.runs === 0) bowl.get(ov.bowlerId)!.maidens += 1;

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    batting: [...bat.values()].map((b) => ({ ...b, strikeRate: b.balls ? round((b.runs / b.balls) * 100) : 0 })),
    bowling: [...bowl].map(([id, o]) => ({
      playerId: id,
      playerName: name(id),
      overs: Number(`${Math.floor(o.legal / 6)}.${o.legal % 6}`),
      runsConceded: o.runs,
      wickets: o.wickets,
      maidens: o.maidens,
      economy: o.legal ? round(o.runs / (o.legal / 6)) : 0,
    })),
    fielding: [...field.values()],
  };
}

export async function getMatchScorecard(matchId: string): Promise<MatchScorecard | null> {
  const match = await matches.first({ id: matchId });
  if (!match) return null;

  const { replaying, list: events } = await visibleEvents(matchId);
  const totals = teamTotals(events);

  if (replaying) {
    const players = await db.orm.public.MatchPlayer.where({ matchId }).include("player").all();
    const names = new Map(players.map((mp) => [mp.playerId, mp.player.displayName ?? mp.player.name]));
    return { matchId, totals, ...replayPlayerStats(events, names) };
  }

  const performances = await db.orm.public.PlayerPerformance.where({ matchId })
    .include("player")
    .include("batting")
    .include("bowling")
    .include("fielding")
    .all();

  const name = (p: { name: string; displayName: string | null }) => p.displayName ?? p.name;

  return {
    matchId,
    totals,
    batting: performances.flatMap((p) =>
      p.batting
        ? [{
            playerId: p.player.id,
            playerName: name(p.player),
            runs: p.batting.runs,
            balls: p.batting.balls,
            fours: p.batting.fours,
            sixes: p.batting.sixes,
            strikeRate: Number(p.batting.strikeRate),
            dismissalType: p.batting.dismissalType,
          }]
        : [],
    ),
    bowling: performances.flatMap((p) =>
      p.bowling
        ? [{
            playerId: p.player.id,
            playerName: name(p.player),
            overs: Number(p.bowling.overs),
            runsConceded: p.bowling.runsConceded,
            wickets: p.bowling.wickets,
            maidens: p.bowling.maidens,
            economy: Number(p.bowling.economy),
          }]
        : [],
    ),
    fielding: performances.flatMap((p) =>
      p.fielding
        ? [{
            playerId: p.player.id,
            playerName: name(p.player),
            catches: p.fielding.catches,
            runOuts: p.fielding.runOuts,
            stumpings: p.fielding.stumpings,
            missedCatches: p.fielding.missedCatches,
          }]
        : [],
    ),
  };
}
