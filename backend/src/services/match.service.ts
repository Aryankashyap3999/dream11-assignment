import { db } from "../prisma/db";
import { isLegalBall } from "./analysis.service";
import type {
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

export async function getMatchScorecard(matchId: string): Promise<MatchScorecard | null> {
  const match = await matches.first({ id: matchId });
  if (!match) return null;

  const performances = await db.orm.public.PlayerPerformance.where({ matchId })
    .include("player")
    .include("batting")
    .include("bowling")
    .include("fielding")
    .all();

  const events = await db.orm.public.MatchEvent.where({ matchId })
    .include("team")
    .include("cricketDelivery")
    .include("cricketWicket")
    .all();

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

  const name = (p: { name: string; displayName: string | null }) => p.displayName ?? p.name;

  return {
    matchId,
    totals: [...totals.values()],
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
