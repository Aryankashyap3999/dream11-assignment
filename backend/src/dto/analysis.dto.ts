export interface MatchSituation {
  teamId: string | null;
  runs: number;
  wickets: number;
  balls: number;
  runsRequired: number | null;
  ballsRemaining: number | null;
  requiredRunRate: number | null;
}

export interface RecentBall {
  runs: number;
  totalRuns: number;
  isBoundary: boolean;
  isWicket: boolean;
}

export interface RecentForm {
  last6Balls: RecentBall[];
  runs: number;
  wickets: number;
  boundaries: number;
}

export interface Momentum {
  score: number;
  direction: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

export interface KeyMoment {
  eventId: string | null;
  type: string;
  title: string;
  description: string | null;
  impactScore: number | null;
}

export interface PlayerToWatch {
  playerId: string;
  name: string;
  teamId: string | null;
  role: string | null;
  reason: string;
}

export interface AnalysisResponse {
  matchId: string;
  situation: MatchSituation;
  recentForm: RecentForm;
  momentum: Momentum;
  keyMoments: KeyMoment[];
  playerToWatch: PlayerToWatch | null;
}
