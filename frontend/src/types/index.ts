export interface Team {
  id: string
  name: string
  shortName: string | null
  logoUrl: string | null
  role: string | null
}

export interface Match {
  id: string
  name: string
  format: string | null
  status: string
  venue: string | null
  startTime: string | null
  endTime: string | null
  lastUpdatedAt: string
  sport: { code: string; name: string }
  teams: Team[]
}

export interface MatchDetails extends Match {
  players: { id: string; name: string; teamId: string; role: string | null; isStarting: boolean }[]
}

export interface TeamTotal {
  teamId: string
  teamName: string
  runs: number
  wickets: number
  balls: number
}

export interface Scorecard {
  matchId: string
  totals: TeamTotal[]
}

export interface Situation {
  teamId: string | null
  runs: number
  wickets: number
  balls: number
  runsRequired: number | null
  ballsRemaining: number | null
  requiredRunRate: number | null
}

export interface RecentBall {
  runs: number
  totalRuns: number
  isBoundary: boolean
  isWicket: boolean
}

export interface RecentForm {
  last6Balls: RecentBall[]
  runs: number
  wickets: number
  boundaries: number
}

export interface Momentum {
  score: number
  direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
}

export interface KeyMoment {
  eventId: string | null
  type: string
  title: string
  description: string | null
  impactScore: number | null
}

export interface PlayerToWatch {
  playerId: string
  name: string
  teamId: string | null
  role: string | null
  reason: string
}

export interface Analysis {
  matchId: string
  situation: Situation
  recentForm: RecentForm
  momentum: Momentum
  keyMoments: KeyMoment[]
  playerToWatch: PlayerToWatch | null
}

export interface AIInsight {
  headline: string
  whatChanged: string
  whyItMatters: string
  watchNext: string
}

export interface AskResponse {
  answer: string
}
