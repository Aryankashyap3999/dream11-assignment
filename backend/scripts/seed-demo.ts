// Deterministic demo seed: one live T20 (Australia 176/4, India chasing at 86/3 after 10.5 overs).
// Safe to re-run: only the demo match, teams and players (fixed UUIDs) are deleted and recreated.
import { db } from "../src/prisma/db";

const orm = db.orm.public;
const uid = (kind: string, n = 0) => `00000000-0000-4000-8000-${kind}${String(n).padStart(8, "0")}`;

const MATCH_ID = uid("0002");
const TEAMS = [
  { id: uid("0010"), name: "India", shortName: "IND", role: "HOME" },
  { id: uid("0011"), name: "Australia", shortName: "AUS", role: "AWAY" },
];
const [IND, AUS] = TEAMS;

const ROLES = ["BATTER", "BATTER", "ALL_ROUNDER", "WICKET_KEEPER", "BOWLER", "BOWLER"];
const NAMES = {
  [IND.id]: ["Aarav Sharma", "Vikram Rao", "Kabir Nair", "Ishaan Verma", "Rohan Iyer", "Dev Malhotra"],
  [AUS.id]: ["Jack Holloway", "Liam Carter", "Ethan Brooks", "Oscar Hayes", "Noah Fraser", "Mason Reed"],
};
const PLAYERS = TEAMS.flatMap((t, ti) =>
  NAMES[t.id].map((name, i) => ({ id: uid("0100", ti * 10 + i), name, role: ROLES[i], teamId: t.id })),
);
const squad = (teamId: string) => PLAYERS.filter((p) => p.teamId === teamId).map((p) => p.id);

// One string per over. Token: 0-6 runs off the bat, W wicket, wd wide, nb no-ball.
// Wides and no-balls are extra deliveries, so an over with one has 7 tokens.
const INNINGS = [
  {
    battingTeam: AUS.id, bowlingTeam: IND.id,
    overs: [
      "1 0 4 1 0 1", "0 1 6 0 2 1", "1 4 0 wd 1 1 0", "2 0 1 W 1 1", "4 1 0 6 1 1",
      "1 1 2 0 4 0", "1 2 1 0 1 1", "0 4 1 1 W 1", "1 1 6 0 2 1", "2 1 0 1 4 1",
      "1 0 1 1 6 1", "4 1 nb 1 2 0 1", "1 1 0 1 2 1", "2 4 1 1 0 6", "1 1 W 1 2 1",
      "1 1 4 0 1 2", "1 1 4 1 1 0", "1 4 1 1 2 1", "1 4 0 wd 1 W 2", "1 4 1 2 1 1",
    ],
  },
  {
    battingTeam: IND.id, bowlingTeam: AUS.id,
    overs: [
      "1 0 1 4 0 1", "0 1 W 1 2 0", "4 1 0 wd 1 1 2", "1 0 6 1 0 1", "2 1 1 0 4 1",
      "0 1 1 W 2 1", "1 2 0 1 1 4", "1 0 1 1 2 1", "4 0 1 W 1 1", "1 2 0 1 nb 1 1",
      "1 0 wd 4 6 1", // 10.5 overs bowled: momentum +28, mix of boundaries and a wide
    ],
  },
];

async function cleanup() {
  await orm.Match.where({ id: MATCH_ID }).delete(); // cascades to teams, players, periods, events, deliveries, wickets, performances, moments
  for (const p of PLAYERS) {
    await orm.TeamPlayer.where({ playerId: p.id }).delete();
    await orm.Player.where({ id: p.id }).delete();
  }
  for (const t of TEAMS) await orm.Team.where({ id: t.id }).delete();
}

async function ensureRow<T extends { id: string }>(find: Promise<T | null>, create: () => Promise<T>) {
  return (await find) ?? create();
}

async function main() {
  await cleanup();

  const sport = await ensureRow(orm.Sport.first({ code: "CRICKET" }), () =>
    orm.Sport.create({ id: uid("0001"), code: "CRICKET", name: "Cricket" }),
  );
  const perfType = async (code: string, n: number) =>
    ensureRow(orm.PerformanceType.first({ code }), () =>
      orm.PerformanceType.create({ id: uid("0003", n), code, name: code[0] + code.slice(1).toLowerCase() }),
    );
  const [BATTING, BOWLING] = [await perfType("BATTING", 1), await perfType("BOWLING", 2)];

  const t0 = Date.UTC(2026, 0, 15, 14, 0, 0);
  await orm.Match.create({
    id: MATCH_ID, sportId: sport.id, name: "India vs Australia, 1st T20I", format: "T20", status: "LIVE",
    venue: "Wankhede Stadium, Mumbai", startTime: new Date(t0), lastUpdatedAt: new Date(t0),
  });

  for (const [i, t] of TEAMS.entries()) {
    await orm.Team.create({ id: t.id, name: t.name, shortName: t.shortName });
    await orm.MatchTeam.create({ id: uid("0012", i), matchId: MATCH_ID, teamId: t.id, role: t.role, position: i + 1 });
  }
  for (const [i, p] of PLAYERS.entries()) {
    await orm.Player.create({ id: p.id, name: p.name });
    await orm.TeamPlayer.create({ id: uid("0101", i), teamId: p.teamId, playerId: p.id, role: p.role });
    await orm.MatchPlayer.create({ id: uid("0102", i), matchId: MATCH_ID, playerId: p.id, teamId: p.teamId, role: p.role, isStarting: true });
  }

  let seq = 0;
  const stats = new Map<string, { runs: number; balls: number; fours: number; sixes: number; out: string | null }>();
  const bowls = new Map<string, { legal: number; runs: number; wickets: number }>();

  for (const [ii, inn] of INNINGS.entries()) {
    const periodId = uid("0020", ii + 1);
    await orm.MatchPeriod.create({
      id: periodId, matchId: MATCH_ID, periodNumber: ii + 1, periodType: "INNINGS",
      startTime: new Date(t0 + seq * 45_000), endTime: ii === 0 ? new Date(t0 + 124 * 45_000) : null,
    });

    const batters = squad(inn.battingTeam);
    const bowlers = squad(inn.bowlingTeam);
    let [striker, other, next] = [batters[0], batters[1], 2];

    for (const [over, overText] of inn.overs.entries()) {
      const bowlerId = bowlers[over % bowlers.length];
      let legal = 0;
      for (const token of overText.split(" ")) {
        seq++;
        const extraType = token === "wd" ? "wide" : token === "nb" ? "noball" : null;
        const wicket = token === "W";
        const bat = extraType || wicket ? 0 : Number(token);
        const extras = extraType ? 1 : 0;
        const isBoundary = bat === 4 || bat === 6;
        if (!extraType) legal++;

        const eventId = uid("1000", seq);
        const timestamp = new Date(t0 + seq * 45_000);
        await orm.MatchEvent.create({
          id: eventId, matchId: MATCH_ID, periodId, eventType: wicket ? "WICKET" : "DELIVERY",
          sequenceNumber: BigInt(seq), timestamp, teamId: inn.battingTeam, playerId: striker,
        });
        await orm.CricketDelivery.create({
          eventId, overNumber: over, ballNumber: legal, batterId: striker, bowlerId,
          totalRuns: bat + extras, batterRuns: bat, extras, extraType, isBoundary,
        });

        const s = stats.get(striker) ?? { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
        const b = bowls.get(bowlerId) ?? { legal: 0, runs: 0, wickets: 0 };
        s.runs += bat; if (!extraType) s.balls++;
        s.fours += bat === 4 ? 1 : 0; s.sixes += bat === 6 ? 1 : 0;
        b.runs += bat + extras; if (!extraType) b.legal++;
        if (wicket) { b.wickets++; s.out = seq % 2 ? "caught" : "bowled"; }
        stats.set(striker, s); bowls.set(bowlerId, b);

        if (wicket) {
          await orm.CricketWicket.create({
            eventId, playerId: striker, wicketType: s.out!,
            fielderId: s.out === "caught" ? bowlers[(over + 1) % bowlers.length] : null,
          });
        }
        if (isBoundary || wicket) {
          if (ii === 1) {
            const type = wicket ? "WICKET" : bat === 6 ? "SIX" : "FOUR";
            await orm.KeyMoment.create({
              id: uid("0030", seq), matchId: MATCH_ID, eventId, teamId: inn.battingTeam, momentType: type,
              impactScore: String({ WICKET: 80, SIX: 60, FOUR: 40 }[type]), title: type[0] + type.slice(1).toLowerCase(),
              description: `${type} at ${over}.${legal}`, detectedAt: timestamp,
            });
          }
        }

        if (wicket) striker = batters[next++];
        else if (bat % 2 === 1) [striker, other] = [other, striker];
        if (legal === 6 && !extraType) { [striker, other] = [other, striker]; legal = 7; } // end of over
      }
    }
  }

  let n = 0;
  for (const [playerId, s] of stats) {
    const performanceId = uid("0040", ++n);
    await orm.PlayerPerformance.create({ id: performanceId, matchId: MATCH_ID, playerId, performanceTypeId: BATTING.id });
    await orm.CricketBattingPerformance.create({
      performanceId, runs: s.runs, balls: s.balls, fours: s.fours, sixes: s.sixes,
      strikeRate: (s.balls ? (s.runs / s.balls) * 100 : 0).toFixed(2), dismissalType: s.out,
    });
  }
  for (const [playerId, b] of bowls) {
    const performanceId = uid("0040", ++n);
    await orm.PlayerPerformance.create({ id: performanceId, matchId: MATCH_ID, playerId, performanceTypeId: BOWLING.id });
    await orm.CricketBowlingPerformance.create({
      performanceId, overs: `${Math.floor(b.legal / 6)}.${b.legal % 6}`, runsConceded: b.runs,
      wickets: b.wickets, economy: (b.runs / (b.legal / 6)).toFixed(2),
    });
  }

  console.log(`Seeded demo match ${MATCH_ID} (${seq} deliveries)`);
}

main().then(() => db.close(), (e) => { console.error(e); return db.close().then(() => process.exit(1)); });
