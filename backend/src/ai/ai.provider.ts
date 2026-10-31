import type { AIContext, AIInsight } from "../dto/ai.dto";
import { createGeminiProvider } from "./gemini.provider";
import { createGroqProvider } from "./groq.provider";

export interface AIProvider {
  generateInsight(context: AIContext): Promise<AIInsight>;
  answerQuestion(context: AIContext, question: string): Promise<string>;
}

let provider: AIProvider | undefined;

// Provider is chosen only by AI_PROVIDER. Add a case here to support another one.
export function getAIProvider(): AIProvider {
  if (provider) return provider;

  const { AI_PROVIDER, AI_API_KEY, AI_MODEL } = process.env;
  if (!AI_API_KEY || !AI_MODEL) throw new Error("AI_API_KEY and AI_MODEL must be set");

  switch ((AI_PROVIDER ?? "").toLowerCase()) {
    case "gemini":
      return (provider = createGeminiProvider(AI_API_KEY, AI_MODEL));
    case "groq":
      return (provider = createGroqProvider(AI_API_KEY, AI_MODEL));
    default:
      throw new Error(`Unsupported AI_PROVIDER "${AI_PROVIDER ?? ""}"`);
  }
}
