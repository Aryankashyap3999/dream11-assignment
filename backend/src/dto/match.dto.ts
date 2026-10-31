export interface TeamSummary {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  role: string | null;
}

export interface MatchListItem {
  id: string;
  name: string;
  format: string | null;
  status: string;
  venue: string | null;
  startTime: Date | null;
  endTime: Date | null;
  lastUpdatedAt: Date;
  sport: { code: string; name: string };
  teams: TeamSummary[];
}

export interface MatchPlayerSummary {
  id: string;
  name: string;
  teamId: string;
  role: string | null;
  isStarting: boolean;
}

export interface MatchDetails extends MatchListItem {
  players: MatchPlayerSummary[];
}

export interface BattingEntry {
  playerId: string;
  playerName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissalType: string | null;
}

export interface BowlingEntry {
  playerId: string;
  playerName: string;
  overs: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  economy: number;
}

export interface FieldingEntry {
  playerId: string;
  playerName: string;
  catches: number;
  runOuts: number;
  stumpings: number;
  missedCatches: number;
}

export interface TeamTotal {
  teamId: string;
  teamName: string;
  runs: number;
  wickets: number;
  balls: number;
}

export interface MatchScorecard {
  matchId: string;
  totals: TeamTotal[];
  batting: BattingEntry[];
  bowling: BowlingEntry[];
  fielding: FieldingEntry[];
}
