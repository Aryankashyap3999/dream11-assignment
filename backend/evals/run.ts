// Baseline AI evaluation: npm run eval:ai
// Calls the production provider (getAIProvider().answerQuestion) with fixture contexts, 3 runs per case,
// and checks answers with deterministic assertions only. No LLM judge.
// Measured layer: prompts + provider + model. The service-level validator/retry in ai.service.ts needs a DB
// match and is not exported, so it is NOT exercised here.
// Exit code is non-zero only for infrastructure failures, never for failed assertions.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAIProvider } from "../src/ai/ai.provider";
import { CASES, CATEGORIES, type EvalCase } from "./cases";
import { FIXTURES, checkFixtures } from "./fixtures";

const RUNS = 3;
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 1500); // pacing between calls; not a retry
const HARD_TIMEOUT_MS = 45_000;

type Status = "SUCCESS" | "ASSERTION_FAILURE" | "PROVIDER_ERROR" | "TIMEOUT" | "PARSE_ERROR";
interface Execution {
  caseId: string; run: number; status: Status; latencyMs: number;
  answer?: string; failedAssertions?: string[]; error?: string;
}

const redact = (s: string) => {
  const key = process.env.AI_API_KEY;
  return (key ? s.split(key).join("[REDACTED]") : s).replace(/(bearer\s+|gsk_|AIza)[\w-]+/gi, "$1[REDACTED]").slice(0, 300);
};

function classify(err: unknown): { status: Status; error: string } {
  const name = err instanceof Error ? err.name : "";
  const msg = redact(err instanceof Error ? err.message : String(err));
  if (name === "TimeoutError" || name === "AbortError" || /time(d)?[ -]?out|aborted/i.test(msg)) return { status: "TIMEOUT", error: msg };
  if (name === "SyntaxError" || /empty response|JSON/i.test(msg)) return { status: "PARSE_ERROR", error: msg };
  return { status: "PROVIDER_ERROR", error: msg };
}

async function execute(c: EvalCase, run: number): Promise<Execution> {
  const ctx = FIXTURES[c.fixture].context;
  const start = Date.now();
  let timer: NodeJS.Timeout;
  try {
    const answer = await Promise.race([
      getAIProvider().answerQuestion(ctx, c.question),
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error("eval hard timeout"), { name: "TimeoutError" })), HARD_TIMEOUT_MS); }),
    ]);
    const text = answer.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\s\u00a0\u202f]+/g, " "); // curly quotes / odd spaces
    const failed = c.assertions.filter((a) => !a.check(text, ctx)).map((a) => a.name);
    return { caseId: c.id, run, status: failed.length ? "ASSERTION_FAILURE" : "SUCCESS", latencyMs: Date.now() - start, answer, ...(failed.length && { failedAssertions: failed }) };
  } catch (err) {
    return { caseId: c.id, run, latencyMs: Date.now() - start, ...classify(err) };
  } finally {
    clearTimeout(timer!);
  }
}

function validateSuite() {
  checkFixtures();
  const ids = new Set(CASES.map((c) => c.id));
  if (CASES.length !== 40 || ids.size !== 40) throw new Error(`expected 40 unique cases, got ${CASES.length}/${ids.size}`);
  for (const cat of CATEGORIES) {
    if (CASES.filter((c) => c.category === cat).length !== 4) throw new Error(`category "${cat}" must have 4 cases`);
  }
  getAIProvider(); // throws if AI_PROVIDER / AI_API_KEY / AI_MODEL are missing
}

async function main() {
  validateSuite();
  const { AI_PROVIDER, AI_MODEL } = process.env;
  console.log(`MatchPulse AI baseline eval: provider=${AI_PROVIDER} model=${AI_MODEL}, ${CASES.length} cases x ${RUNS} runs`);

  const results: Execution[] = [];
  for (const c of CASES) {
    for (let run = 1; run <= RUNS; run++) {
      const r = await execute(c, run);
      results.push(r);
      console.log(`  ${c.id} run ${run}: ${r.status}${r.failedAssertions ? ` [${r.failedAssertions.join("; ")}]` : r.error ? ` (${r.error})` : ""}`);
      if (DELAY_MS) await new Promise((res) => setTimeout(res, DELAY_MS));
    }
  }

  const count = (rs: Execution[], s: Status) => rs.filter((r) => r.status === s).length;
  const tally = (rs: Execution[]) => ({
    executions: rs.length, successes: count(rs, "SUCCESS"), assertionFailures: count(rs, "ASSERTION_FAILURE"),
    providerErrors: count(rs, "PROVIDER_ERROR"), timeouts: count(rs, "TIMEOUT"), parseErrors: count(rs, "PARSE_ERROR"),
  });
  const byCase = new Map(CASES.map((c) => [c.id, c]));
  const categories = Object.fromEntries(
    CATEGORIES.map((cat) => [cat, tally(results.filter((r) => byCase.get(r.caseId)!.category === cat))]),
  );
  const failurePatterns: Record<string, number> = {};
  for (const r of results) for (const f of r.failedAssertions ?? []) failurePatterns[`${r.caseId}: ${f}`] = (failurePatterns[`${r.caseId}: ${f}`] ?? 0) + 1;
  const perCase = CASES.map((c) => {
    const rs = results.filter((r) => r.caseId === c.id);
    return { id: c.id, category: c.category, fixture: c.fixture, question: c.question, expectedBehavior: c.expectedBehavior, ...tally(rs) };
  });

  const total = tally(results);
  const report = {
    generatedAt: new Date().toISOString(),
    provider: AI_PROVIDER, model: AI_MODEL,
    measuredLayer: "prompts + provider + model (ai.service validators/retry not exercised)",
    totalCases: CASES.length, runsPerCase: RUNS, totalExecutions: results.length,
    successes: total.successes, assertionFailures: total.assertionFailures, providerErrors: total.providerErrors,
    timeouts: total.timeouts, parseErrors: total.parseErrors,
    categories, perCase,
    failurePatterns: Object.entries(failurePatterns).sort((x, y) => y[1] - x[1]).map(([pattern, count]) => ({ pattern, count })),
    executions: results,
  };

  const dir = join(import.meta.dirname, "results");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `ai-baseline-${report.generatedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));

  console.log(`\n${"Category".padEnd(24)} passed failed provider-err`);
  for (const [cat, t] of Object.entries(categories)) {
    console.log(`${cat.padEnd(24)} ${`${t.successes}/${t.executions}`.padEnd(7)} ${String(t.assertionFailures).padEnd(6)} ${t.providerErrors + t.timeouts + t.parseErrors}`);
  }
  console.log(`\nSUCCESS ${total.successes} | ASSERTION_FAILURE ${total.assertionFailures} | PROVIDER_ERROR ${total.providerErrors} | TIMEOUT ${total.timeouts} | PARSE_ERROR ${total.parseErrors}`);
  console.log(`Result file: ${file}`);

  // No usable signal at all (e.g. bad key / provider down) means the run itself is broken.
  if (total.successes + total.assertionFailures === 0) throw new Error("every execution failed before an answer was produced");
}

main().catch((err) => {
  console.error(`Eval infrastructure failure: ${redact(err instanceof Error ? err.message : String(err))}`);
  process.exit(1);
});
