import type { AnalysisResponse } from "./analysis.dto";

export interface AIContext {
  match: { name: string; format: string | null; teams: { id: string; name: string }[] };
  analysis: AnalysisResponse;
  live: LiveContext;
}

// Pre-computed from replay-visible deliveries only. null = not available. Names, not ids.
export interface LiveContext {
  batter: { name: string; runs: number; balls: number; fours: number; sixes: number } | null; // on strike for the latest delivery
  bowler: { name: string; overs: number; runsConceded: number; wickets: number } | null;
  latestEvent: { type: "WICKET" | "SIX" | "FOUR" | "RUNS" | "DOT"; batter: string; bowler: string; team: string | null; runs: number; dismissal?: { batterOut: string; how: string; fielder: string | null } } | null;
}

export interface AIInsight {
  headline: string;
  whatChanged: string;
  whyItMatters: string;
  watchNext: string;
}

export interface AIAnswer {
  answer: string;
}
