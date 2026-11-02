// Mirrors askQuestion() in src/services/ai.service.ts without the DB: route, then guarded LLM call.
// Not covered: inventsCounts (private to ai.service.ts, needs no DB but is not exported; exporting it would touch production code).
import type { AIContext } from "../src/dto/ai.dto";
import { generateGuarded } from "../src/services/ai.safety";
import { routeQuestion, type QuestionRoute } from "../src/services/ai.question-router";

export type Generate = (context: AIContext, question: string, note?: string) => Promise<string>;

export async function runPipeline(context: AIContext, question: string, generate: Generate): Promise<{ route: QuestionRoute; answer: string }> {
  const routed = routeQuestion(question, context);
  if (routed.route !== "LLM") return { route: routed.route, answer: routed.answer };
  const answer = await generateGuarded(context, (note) => generate(context, question, note), (a) => a, () => true, "unreachable");
  return { route: "LLM", answer };
}
