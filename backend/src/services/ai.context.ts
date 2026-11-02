import type { LiveContext } from "../dto/ai.dto";
import { replayPlayerStats, type ScoreEvent } from "./match.service";

/**
 * Current batter/bowler/latest event from the already replay-filtered events (sorted by sequence).
 * Stats are rebuilt from those events, never from final player_performances rows, so nothing from the future leaks.
 * The data has no non-striker, so only the batter on strike for the latest delivery is reported.
 */
export function buildLiveContext(events: ScoreEvent[], names: Map<string, string>): LiveContext {
  const last = events.filter((e) => e.cricketDelivery).at(-1);
  const d = last?.cricketDelivery;
  if (!last || !d) return { batter: null, bowler: null, latestEvent: null };

  const name = (id: string) => names.get(id) ?? "Unknown player";
  const stats = replayPlayerStats(events, names);
  const bat = stats.batting.find((b) => b.playerId === d.batterId);
  const bowl = stats.bowling.find((b) => b.playerId === d.bowlerId);
  const w = last.cricketWicket;

  return {
    batter: bat ? { name: bat.playerName, runs: bat.runs, balls: bat.balls, fours: bat.fours, sixes: bat.sixes } : null,
    bowler: bowl ? { name: bowl.playerName, overs: bowl.overs, runsConceded: bowl.runsConceded, wickets: bowl.wickets } : null,
    latestEvent: {
      type: w ? "WICKET" : d.isBoundary && d.batterRuns >= 6 ? "SIX" : d.isBoundary ? "FOUR" : d.totalRuns ? "RUNS" : "DOT",
      batter: name(d.batterId),
      bowler: name(d.bowlerId),
      team: last.team?.name ?? null,
      runs: d.totalRuns,
      ...(w && { dismissal: { batterOut: name(w.playerId), how: w.wicketType, fielder: w.fielderId ? name(w.fielderId) : null } }),
    },
  };
}
