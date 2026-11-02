// Live AI evaluation: npm run eval:ai
// Runs each case through evals/pipeline.ts (router -> safety-guarded provider call, provider retry included) with fixture
// contexts and checks answers with deterministic assertions only. No LLM judge.
// Questions the router answers deterministically or refuses make NO provider call and run once; only LLM-routed questions run EVAL_RUNS times.
// Deterministic (no-network) evaluation lives in tests/ai.eval.test.ts and runs under npm test.
// Exit code is non-zero only for infrastructure failures, never for failed assertions.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAIProvider } from "../src/ai/ai.provider";
import { CASES, CATEGORIES, type EvalCase } from "./cases";
import { FIXTURES, checkFixtures } from "./fixtures";
import { runPipeline } from "./pipeline";
import { makePacer, parseDelayMs } from "./pacing";
import { isUnsafeOutput } from "../src/services/ai.safety";
import { routeQuestion } from "../src/services/ai.question-router";

const RUNS = Number(process.env.EVAL_RUNS ?? 3);
const DELAY_MS = parseDelayMs(process.env.EVAL_DELAY_MS); // pacing between LLM calls; not a retry
const HARD_TIMEOUT_MS = 45_000;

type Status = "PASS" | "ASSERTION_FAILURE" | "PROVIDER_ERROR" | "TIMEOUT" | "PARSE_ERROR";
interface Execution {
  caseId: string; run: number; status: Status; latencyMs: number;
  route?: string; answer?: string; failedAssertions?: string[]; error?: string;
}

const redact = (s: string) => {
  const key = process.env.AI_API_KEY;
  return (key ? s.split(key).join("[REDACTED]") : s).replace(/(bearer\s+|gsk_|AIza)[\w-]+/gi, "$1[REDACTED]").slice(0, 300);
};

function classify(err: unknown): { status: Status; error: string; failedAssertions?: string[] } {
  const name = err instanceof Error ? err.name : "";
  const msg = redact(err instanceof Error ? err.message : String(err));
  // The model itself produced unsafe output twice: a quality failure, not provider availability.
  if (/failed safety checks/.test(msg)) return { status: "ASSERTION_FAILURE", error: msg, failedAssertions: ["output safety guard rejected both attempts"] };
  if (name === "TimeoutError" || name === "AbortError" || /time(d)?[ -]?out|aborted/i.test(msg)) return { status: "TIMEOUT", error: msg };
  if (name === "SyntaxError" || /empty response|JSON/i.test(msg)) return { status: "PARSE_ERROR", error: msg };
  return { status: "PROVIDER_ERROR", error: msg };
}

const pace = makePacer(DELAY_MS); // router-answered/refused cases never call generate, so they are never delayed

async function execute(c: EvalCase, run: number): Promise<Execution> {
  const ctx = FIXTURES[c.fixture].context;
  const start = Date.now();
  let timer: NodeJS.Timeout;
  try {
    const { route, answer } = await Promise.race([
      runPipeline(ctx, c.question, async (cx, q, note) => { await pace(); return getAIProvider().answerQuestion(cx, q, note); }),
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error("eval hard timeout"), { name: "TimeoutError" })), HARD_TIMEOUT_MS); }),
    ]);
    const text = answer.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\s\u00a0\u202f]+/g, " "); // curly quotes / odd spaces
    // Routed (non-LLM) refusals are fixed text: only ANSWER cases are checked against the content assertions; every answer must be safe.
    const failed = [
      ...(route === "LLM" || c.expectedBehavior === "ANSWER" ? c.assertions.filter((a) => !a.check(text, ctx)).map((a) => a.name) : []),
      ...(isUnsafeOutput(text, ctx) ? ["answer passes the output safety guard"] : []),
    ];
    return { caseId: c.id, run, route, status: failed.length ? "ASSERTION_FAILURE" : "PASS", latencyMs: Date.now() - start, answer, ...(failed.length && { failedAssertions: failed }) };
  } catch (err) {
    return { caseId: c.id, run, latencyMs: Date.now() - start, ...classify(err) };
  } finally {
    clearTimeout(timer!);
  }
}

function validateSuite() {
  checkFixtures();
  const ids = new Set(CASES.map((c) => c.id));
  if (ids.size !== CASES.length) throw new Error("duplicate case ids");
  for (const cat of CATEGORIES) {
    if (CASES.filter((c) => c.category === cat).length < 4) throw new Error(`category "${cat}" must have at least 4 cases`);
  }
  getAIProvider(); // throws if AI_PROVIDER / AI_API_KEY / AI_MODEL are missing
}

async function main() {
  validateSuite();
  const { AI_PROVIDER, AI_MODEL } = process.env;
  console.log(`MatchPulse AI eval: provider=${AI_PROVIDER} model=${AI_MODEL}, ${CASES.length} cases (${CASES.filter((c) => routeQuestion(c.question, FIXTURES[c.fixture].context).route === "LLM").length} LLM-routed x ${RUNS} runs)`);

  const results: Execution[] = [];
  for (const c of CASES) {
    const runs = routeQuestion(c.question, FIXTURES[c.fixture].context).route === "LLM" ? RUNS : 1; // deterministic routes cannot vary
    for (let run = 1; run <= runs; run++) {
      const r = await execute(c, run);
      results.push(r);
      console.log(`  ${c.id} run ${run}: ${r.status}${r.failedAssertions ? ` [${r.failedAssertions.join("; ")}]` : r.error ? ` (${r.error})` : ""}`);
    }
  }

  const count = (rs: Execution[], s: Status) => rs.filter((r) => r.status === s).length;
  const tally = (rs: Execution[]) => ({
    executions: rs.length, passes: count(rs, "PASS"), assertionFailures: count(rs, "ASSERTION_FAILURE"),
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
    measuredLayer: "router + output safety guard + provider retry + prompts + model (inventsCounts not exercised)",
    totalCases: CASES.length, llmRunsPerCase: RUNS, llmCalls: results.filter((r) => r.route === "LLM" || r.route === undefined).length,
    routes: Object.fromEntries(["DETERMINISTIC", "UNSUPPORTED", "LLM"].map((k) => [k, results.filter((r) => r.route === k).length])), totalExecutions: results.length,
    passes: total.passes, assertionFailures: total.assertionFailures, providerErrors: total.providerErrors,
    timeouts: total.timeouts, parseErrors: total.parseErrors,
    categories, perCase,
    failurePatterns: Object.entries(failurePatterns).sort((x, y) => y[1] - x[1]).map(([pattern, count]) => ({ pattern, count })),
    executions: results,
  };

  const dir = join(import.meta.dirname, "results");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `ai-eval-${report.generatedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));

  console.log(`\n${"Category".padEnd(24)} passed failed provider-err`);
  for (const [cat, t] of Object.entries(categories)) {
    console.log(`${cat.padEnd(24)} ${`${t.passes}/${t.executions}`.padEnd(7)} ${String(t.assertionFailures).padEnd(6)} ${t.providerErrors + t.timeouts + t.parseErrors}`);
  }
  console.log(`\nPASS ${total.passes} | ASSERTION_FAILURE ${total.assertionFailures} | PROVIDER_ERROR ${total.providerErrors} | TIMEOUT ${total.timeouts} | PARSE_ERROR ${total.parseErrors}`);
  console.log(`Result file: ${file}`);

  // No usable signal at all (e.g. bad key / provider down) means the run itself is broken.
  if (total.passes + total.assertionFailures === 0) throw new Error("every execution failed before an answer was produced");
}

main().catch((err) => {
  console.error(`Eval infrastructure failure: ${redact(err instanceof Error ? err.message : String(err))}`);
  process.exit(1);
});
