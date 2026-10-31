import type { AIContext, AIInsight } from "../dto/ai.dto";
import type { AIProvider } from "./ai.provider";
import { SYSTEM_PROMPT, insightPrompt, questionPrompt } from "./prompts";

// Groq exposes an OpenAI-compatible REST API, so plain fetch is enough (no SDK).
export function createGroqProvider(apiKey: string, model: string): AIProvider {
  async function generate(prompt: string, json: boolean): Promise<string> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000), // fail fast instead of hanging the HTTP request
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        ...(json && { response_format: { type: "json_object" } }),
      }),
    });
    if (!res.ok) throw new Error(`Groq request failed with status ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("AI provider returned an empty response");
    return text;
  }

  return {
    async generateInsight(context: AIContext): Promise<AIInsight> {
      const parsed = JSON.parse(await generate(insightPrompt(context), true));
      for (const f of ["headline", "whatChanged", "whyItMatters", "watchNext"] as const) {
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
