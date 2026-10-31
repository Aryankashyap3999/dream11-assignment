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

// Cheap guard for invented counts: "two fours", "3 sixes", "two boundaries" must match recentForm.last6Balls.
// ponytail: only checks spelled counts of fours/sixes/boundaries; not a general fact checker.
const WORD_NUMBERS: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
function inventsCounts(answer: string, context: AIContext): boolean {
  const balls = context.analysis.recentForm.last6Balls;
  const actual: Record<string, number> = {
    four: balls.filter((b) => b.isBoundary && b.totalRuns === 4).length,
    six: balls.filter((b) => b.isBoundary && b.totalRuns === 6).length,
    boundar: balls.filter((b) => b.isBoundary).length,
  };
  const claim = /\b(\d+|a|one|two|three|four|five|six)\s+(four|six|boundar)(?:s|es|ies|y)?\b/gi;
  return [...answer.matchAll(claim)].some(
    (m) => (WORD_NUMBERS[m[1].toLowerCase()] ?? Number(m[1])) !== actual[m[2].toLowerCase()],
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
  if (!context) return null;
  for (let attempt = 1; attempt <= INSIGHT_ATTEMPTS; attempt++) {
    const answer = await getAIProvider().answerQuestion(context, question);
    if (!inventsCounts(answer, context)) return { answer };
  }
  throw new Error("AI answer invented a boundary count after retry");
}
