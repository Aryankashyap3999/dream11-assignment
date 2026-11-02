// Deterministic AIContext fixtures. Static literals: no DB, no live match, no replay timers.
// A, C and D mirror what getMatchAnalysis() returns for the seeded demo match (scripts/seed-demo.ts)
// at three positions: full chase (A), first delivery (C), replay paused at sequence 150 (D).
// B is hand-authored to cover the "no chase numbers" case. E is hand-authored: a wicket has just fallen (61/3, 8.4 overs).
// The `live` blocks are hand-authored to be consistent with each fixture's analysis (buildLiveContext itself is covered in tests/ai.context.test.ts).
import type { AIContext } from "../src/dto/ai.dto";

export type FixtureId = "A" | "B" | "C" | "D" | "E";
export interface Fixture {
  id: FixtureId;
  description: string;
  context: AIContext;
}

const IND = { id: "00000000-0000-4000-8000-001000000000", name: "India" };
const AUS = { id: "00000000-0000-4000-8000-001100000000", name: "Australia" };
const AARAV = "00000000-0000-4000-8000-010000000000";
const JACK = "00000000-0000-4000-8000-010000000010";

const evId = (seq: number) => `00000000-0000-4000-8000-1000${String(seq).padStart(8, "0")}`;
const ball = (runs: number, totalRuns: number, isBoundary = false, isWicket = false) => ({ runs, totalRuns, isBoundary, isWicket });
const form = (last6Balls: ReturnType<typeof ball>[]) => ({
  last6Balls,
  runs: last6Balls.reduce((a, b) => a + b.totalRuns, 0),
  wickets: last6Balls.filter((b) => b.isWicket).length,
  boundaries: last6Balls.filter((b) => b.isBoundary).length,
});
const moment = (seq: number, type: "WICKET" | "SIX" | "FOUR", at: string) => ({
  eventId: evId(seq),
  type,
  title: type[0] + type.slice(1).toLowerCase(),
  description: `${type} at ${at}`,
  impactScore: { WICKET: 80, SIX: 60, FOUR: 40 }[type],
});
type Live = AIContext["live"];
const live = (l: Live): Live => l;
const match = (format: string | null) => ({ name: "India vs Australia, 1st T20I", format, teams: [IND, AUS] });

export const FIXTURES: Record<FixtureId, Fixture> = {
  A: {
    id: "A",
    description: "Mid chase: India 86/3 after 10.5 overs chasing 177; last six 1,0,1(wide),4,6,1",
    context: {
      match: match("T20"),
      analysis: {
        matchId: "00000000-0000-4000-8000-000200000000",
        situation: { teamId: IND.id, runs: 86, wickets: 3, balls: 65, runsRequired: 91, ballsRemaining: 55, requiredRunRate: 9.93 },
        recentForm: form([ball(1, 1), ball(0, 0), ball(0, 1), ball(4, 4, true), ball(6, 6, true), ball(1, 1)]),
        momentum: { score: 28, direction: "POSITIVE" },
        keyMoments: [
          moment(190, "SIX", "10.4"), moment(189, "FOUR", "10.3"), moment(176, "WICKET", "8.4"),
          moment(173, "FOUR", "8.1"), moment(166, "FOUR", "6.6"),
        ],
        playerToWatch: { playerId: AARAV, name: "Aarav Sharma", teamId: IND.id, role: "BATTER", reason: "12 runs off the bat in the last 12 balls" },
      },
      live: live({
        batter: { name: "Aarav Sharma", runs: 41, balls: 30, fours: 4, sixes: 2 },
        bowler: { name: "Liam Carter", overs: 2, runsConceded: 24, wickets: 1 },
        latestEvent: { type: "RUNS", batter: "Aarav Sharma", bowler: "Liam Carter", team: "India", runs: 1 },
      }),
    },
  },
  B: {
    id: "B",
    description: "First innings, format unknown: Australia 52/1 after 6.0 overs; runsRequired, ballsRemaining, requiredRunRate all null",
    context: {
      match: match(null),
      analysis: {
        matchId: "00000000-0000-4000-8000-000200000000",
        situation: { teamId: AUS.id, runs: 52, wickets: 1, balls: 36, runsRequired: null, ballsRemaining: null, requiredRunRate: null },
        recentForm: form([ball(1, 1), ball(0, 0), ball(4, 4, true), ball(1, 1), ball(0, 0), ball(2, 2)]),
        momentum: { score: -12, direction: "NEGATIVE" },
        keyMoments: [moment(33, "FOUR", "5.3"), moment(20, "SIX", "3.2"), moment(14, "WICKET", "2.5")],
        playerToWatch: { playerId: JACK, name: "Jack Holloway", teamId: AUS.id, role: "BATTER", reason: "17 runs off the bat in the last 12 balls" },
      },
      live: live({
        batter: { name: "Jack Holloway", runs: 23, balls: 20, fours: 2, sixes: 1 },
        bowler: { name: "Ishaan Verma", overs: 1, runsConceded: 10, wickets: 1 },
        latestEvent: { type: "RUNS", batter: "Jack Holloway", bowler: "Ishaan Verma", team: "Australia", runs: 2 },
      }),
    },
  },
  C: {
    id: "C",
    description: "Early innings: Australia 1/0 after the first delivery (T20 first innings, so ballsRemaining is 119)",
    context: {
      match: match("T20"),
      analysis: {
        matchId: "00000000-0000-4000-8000-000200000000",
        situation: { teamId: AUS.id, runs: 1, wickets: 0, balls: 1, runsRequired: null, ballsRemaining: 119, requiredRunRate: null },
        recentForm: form([ball(1, 1)]),
        momentum: { score: 0, direction: "NEUTRAL" },
        keyMoments: [],
        playerToWatch: { playerId: JACK, name: "Jack Holloway", teamId: AUS.id, role: "BATTER", reason: "1 runs off the bat in the last 12 balls" },
      },
      live: live({
        batter: { name: "Jack Holloway", runs: 1, balls: 1, fours: 0, sixes: 0 },
        bowler: { name: "Vikram Rao", overs: 0.1, runsConceded: 1, wickets: 0 },
        latestEvent: { type: "RUNS", batter: "Jack Holloway", bowler: "Vikram Rao", team: "Australia", runs: 1 },
      }),
    },
  },
  D: {
    id: "D",
    description: "Replay paused at sequence 150: India 33/1 after 4.2 overs; the rest of the chase is hidden",
    context: {
      match: match("T20"),
      analysis: {
        matchId: "00000000-0000-4000-8000-000200000000",
        situation: { teamId: IND.id, runs: 33, wickets: 1, balls: 26, runsRequired: 144, ballsRemaining: 94, requiredRunRate: 9.19 },
        recentForm: form([ball(6, 6, true), ball(1, 1), ball(0, 0), ball(1, 1), ball(2, 2), ball(1, 1)]),
        momentum: { score: 20, direction: "POSITIVE" },
        keyMoments: [moment(145, "SIX", "3.3"), moment(136, "FOUR", "2.1"), moment(132, "WICKET", "1.3"), moment(127, "FOUR", "0.4")],
        playerToWatch: { playerId: AARAV, name: "Aarav Sharma", teamId: IND.id, role: "BATTER", reason: "10 runs off the bat in the last 12 balls" },
      },
      live: live({
        batter: { name: "Aarav Sharma", runs: 18, balls: 12, fours: 2, sixes: 1 },
        bowler: { name: "Jack Holloway", overs: 1, runsConceded: 9, wickets: 0 },
        latestEvent: { type: "RUNS", batter: "Aarav Sharma", bowler: "Jack Holloway", team: "India", runs: 1 },
      }),
    },
  },
  E: {
    id: "E",
    description: "Wicket position: India 61/3 after 8.4 overs chasing 177; Kabir Nair caught by Oscar Hayes off Jack Holloway on the latest ball",
    context: {
      match: match("T20"),
      analysis: {
        matchId: "00000000-0000-4000-8000-000200000000",
        situation: { teamId: IND.id, runs: 61, wickets: 3, balls: 52, runsRequired: 116, ballsRemaining: 68, requiredRunRate: 10.24 },
        recentForm: form([ball(1, 1), ball(0, 0), ball(4, 4, true), ball(1, 1), ball(0, 0), ball(0, 0, false, true)]),
        momentum: { score: -15, direction: "NEGATIVE" },
        keyMoments: [moment(176, "WICKET", "8.4"), moment(173, "FOUR", "8.1"), moment(166, "FOUR", "6.6")],
        playerToWatch: { playerId: AARAV, name: "Aarav Sharma", teamId: IND.id, role: "BATTER", reason: "5 runs off the bat in the last 12 balls" },
      },
      live: live({
        batter: { name: "Kabir Nair", runs: 14, balls: 11, fours: 1, sixes: 0 },
        bowler: { name: "Jack Holloway", overs: 2, runsConceded: 17, wickets: 2 },
        latestEvent: {
          type: "WICKET", batter: "Kabir Nair", bowler: "Jack Holloway", team: "India", runs: 0,
          dismissal: { batterOut: "Kabir Nair", how: "caught", fielder: "Oscar Hayes" },
        },
      }),
    },
  },
};

// Fail fast (infrastructure error) if fixture A drifts from the agreed seeded state.
export function checkFixtures() {
  const a = FIXTURES.A.context.analysis;
  const expect = (ok: boolean, msg: string) => { if (!ok) throw new Error(`Fixture A drifted: ${msg}`); };
  expect(a.situation.runs === 86 && a.situation.wickets === 3, "score");
  expect(a.situation.runsRequired === 91 && a.situation.ballsRemaining === 55 && a.situation.requiredRunRate === 9.93, "chase numbers");
  expect(a.recentForm.last6Balls.map((b) => b.totalRuns).join() === "1,0,1,4,6,1", "last six");
  expect(a.recentForm.runs === 13 && a.recentForm.wickets === 0 && a.recentForm.boundaries === 2, "last-six aggregates");
  const e = FIXTURES.E.context;
  expect(e.analysis.situation.runs + e.analysis.situation.runsRequired! === 177 && e.analysis.situation.balls + e.analysis.situation.ballsRemaining! === 120, "fixture E chase arithmetic");
  expect(e.live.latestEvent?.type === "WICKET" && e.analysis.recentForm.wickets === 1, "fixture E wicket");
  const b = FIXTURES.B.context.analysis.situation;
  expect(b.runsRequired === null && b.ballsRemaining === null && b.requiredRunRate === null, "fixture B nulls");
}
