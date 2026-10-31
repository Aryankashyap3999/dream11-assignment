import { GoogleGenAI } from "@google/genai";
import type { AIContext, AIInsight } from "../dto/ai.dto";
import type { AIProvider } from "./ai.provider";
import { SYSTEM_PROMPT, insightPrompt, questionPrompt } from "./prompts";

export function createGeminiProvider(apiKey: string, model: string): AIProvider {
  const client = new GoogleGenAI({ apiKey });

  async function generate(contents: string, json: boolean): Promise<string> {
    const res = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.4,
        httpOptions: { timeout: 30_000 }, // fail fast instead of hanging the HTTP request
        ...(json && { responseMimeType: "application/json" }),
      },
    });
    const text = res.text?.trim();
    if (!text) throw new Error("AI provider returned an empty response");
    return text;
  }

  return {
    async generateInsight(context: AIContext): Promise<AIInsight> {
      const parsed = JSON.parse(await generate(insightPrompt(context), true));
      const fields = ["headline", "whatChanged", "whyItMatters", "watchNext"] as const;
      for (const f of fields) {
        if (typeof parsed[f] !== "string" || !parsed[f]) throw new Error(`AI insight missing "${f}"`);
      }
      const { headline, whatChanged, whyItMatters, watchNext } = parsed;
      return { headline, whatChanged, whyItMatters, watchNext };
    },

    answerQuestion(context: AIContext, question: string): Promise<string> {
      return generate(questionPrompt(context, question), false);
    },
  };
}
