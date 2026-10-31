import type { AnalysisResponse } from "./analysis.dto";

export interface AIContext {
  match: { name: string; format: string | null; teams: { id: string; name: string }[] };
  analysis: AnalysisResponse;
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
