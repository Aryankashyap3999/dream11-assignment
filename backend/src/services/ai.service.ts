import { getAIProvider } from "../ai/ai.provider";
import type { AIAnswer, AIContext, AIInsight } from "../dto/ai.dto";
import { getMatchAnalysis } from "./analysis.service";
import { getMatchById } from "./match.service";

async function buildContext(matchId: string): Promise<AIContext | null> {
  const match = await getMatchById(matchId);
  const analysis = match && (await getMatchAnalysis(matchId));
  if (!match || !analysis) return null;
  return {
    match: {
      name: match.name,
      format: match.format,
      teams: match.teams.map((t) => ({ id: t.id, name: t.name })),
    },
    analysis,
  };
}

// Cheap guard for one known failure: the model quoting momentum.score (or any wrong number) as the score.
// Flags "score [is/to/of/at] N" (not "momentum score") and "N/W" or "N for W" with the real wicket count.
// ponytail: deliberately narrow, not a general hallucination detector.
function contradictsScore(insight: AIInsight, runs: number, wickets: number): boolean {
  const text = Object.values(insight).join(" ");
  const scoreClaim = /(?<!momentum\s)\bscore\b(?:\s+(?:is|to|of|at|now|stands at|moves to|moved to|reaches|reached))*\s*:?\s*(\d+)/gi;
  const tally = /\b(\d+)\s*(?:\/|for)\s*(\d+)\b/gi;
  return (
    [...text.matchAll(scoreClaim)].some((m) => Number(m[1]) !== runs) ||
    [...text.matchAll(tally)].some((m) => Number(m[2]) === wickets && Number(m[1]) !== runs)
  );
}

const INSIGHT_ATTEMPTS = 2;

export async function getInsight(matchId: string): Promise<AIInsight | null> {
  const context = await buildContext(matchId);
  if (!context) return null;

  const { runs, wickets } = context.analysis.situation;
  for (let attempt = 1; attempt <= INSIGHT_ATTEMPTS; attempt++) {
    const insight = await getAIProvider().generateInsight(context);
    if (!contradictsScore(insight, runs, wickets)) return insight;
  }
  throw new Error("AI insight contradicted the match score after retry");
}

export async function askQuestion(matchId: string, question: string): Promise<AIAnswer | null> {
  const context = await buildContext(matchId);
  return context && { answer: await getAIProvider().answerQuestion(context, question) };
}
