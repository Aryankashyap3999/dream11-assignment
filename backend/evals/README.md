# MatchPulse AI evaluation harness

> This harness measures the current AI implementation and does not modify production AI behavior.

## Purpose

Two suites: the 45-case baseline (`cases.ts`, default) and the 30-question hard suite (`cases.final.ts`, `EVAL_SUITE=final`). Results and the manual review are summarised in the root README. Give the AI reliability work a measured starting point. Later changes (richer context, deterministic routing, refusals, provider retry, validator/fallback improvements) can be compared against this baseline.

## What is measured

Each execution calls the production provider (`getAIProvider().answerQuestion(context, question)`) with a fixture context. That covers the **prompts + provider + model**.

Not covered: the validator and retry loop in `ai.service.ts`. It builds its context from the database and its validators are not exported, so it cannot be exercised from fixtures without changing production code. In production, an answer that trips `inventsCounts` is retried and then returns a 500; here the raw first answer is scored.

## Fixtures (`fixtures.ts`)

Static `AIContext` literals. No database, no live match, no timers.

| Id | State |
|---|---|
| A | Mid chase: India 86/3 after 10.5 overs, 91 required, 55 balls left, RRR 9.93, last six `1,0,1,4,6,1` (13 runs, 1 four, 1 six, 0 wickets) |
| B | First innings, format unknown: Australia 52/1; `runsRequired`, `ballsRemaining`, `requiredRunRate` all `null` |
| C | Early innings: Australia 1/0 after one delivery |
| D | Replay paused at sequence 150: India 33/1 after 4.2 overs, the rest of the chase hidden |

A, C and D mirror what `getMatchAnalysis` returns for the seeded demo match at those positions. `checkFixtures()` aborts the run if fixture A drifts.

## Cases (`cases.ts`)

40 cases = 10 categories x 4: direct factual, recent events, statistical, analytical, momentum, player, unsupported, prediction, incorrect assumptions, prompt injection.

`expectedBehavior` is what a correct system should do: `ANSWER` from the context, `REFUSE` (context cannot support it, or the instruction must not be followed), or `CORRECT_PREMISE`. Where the context lacks the data (e.g. per-player stats) the expected behavior is `REFUSE` on purpose.

## Runs and classification

Every case runs 3 times (120 executions) because LLM output varies. Each execution is exactly one of:

| Status | Meaning |
|---|---|
| `SUCCESS` | Answer produced, all assertions passed |
| `ASSERTION_FAILURE` | Answer produced, at least one assertion failed |
| `PROVIDER_ERROR` | Provider/HTTP failure (including 429 and 5xx). Never counted as a correctness failure |
| `TIMEOUT` | Provider or harness (45 s) timeout |
| `PARSE_ERROR` | Empty or unparseable provider output |

There is no retry in the harness or the provider. `EVAL_DELAY_MS` (default 4000) only spaces calls out.

## Deterministic assertions (`assertions.ts`)

Programmatic checks only: expected numbers present, forbidden claims absent (negation-aware per sentence), refusal wording, premise-correction wording, no numbers outside the context, no prediction wording, no 5-word overlap with the system prompt, no raw JSON/UUID dump. These are lexical: they catch concrete, checkable failures, not semantic correctness, so a pass is not proof of a good answer and a fail can occasionally be a wording false positive. Read the stored answers in the result file before acting on a single failure.

## Why no LLM judge

A judge model is itself non-deterministic and can share the failure modes being measured, which would make the baseline unreliable and unrepeatable. Assertions are cheap, reproducible and auditable.

## Running

```bash
cd backend
npm run eval:ai
```

Calls to the LLM are spaced by `EVAL_DELAY_MS` (default 4000; `0` disables), e.g. `EVAL_DELAY_MS=8000 npm run eval:ai`. Router-answered/refused cases are never delayed. Provider 429s that survive the production retry are still reported as `PROVIDER_ERROR`.

Needs `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` (loaded from `.env`). It makes 120 real provider calls. Output: a terminal summary and `evals/results/ai-baseline-<timestamp>.json` (totals, per-category and per-case tallies, failure patterns, every answer). API keys are never printed or written; error text is redacted.

The command exits non-zero only when the harness itself fails (bad suite, missing env, every execution erroring before an answer). Failed assertions do not change the exit code.

Type-check the harness with `npx tsc -p evals` (the root `tsc` only covers `src/`).

## Pipeline evaluation (added with router / safety / live-context / retry)

- `pipeline.ts` mirrors `askQuestion()` without the DB: router, then safety-guarded provider call (provider retry included). `inventsCounts` is private to `ai.service.ts` and not exercised.
- `npm run eval:ai` now measures that pipeline. Router-answered/refused questions make no provider call and run once; only LLM-routed questions run `EVAL_RUNS` (default 3) times. Statuses: `PASS`, `ASSERTION_FAILURE`, `PROVIDER_ERROR`, `TIMEOUT`, `PARSE_ERROR`; provider 429s are never counted as quality failures. A model producing unsafe output twice is an `ASSERTION_FAILURE`.
- Fixtures now carry `live` (batter, bowler, latest event). Fixture E is a wicket position (61/3, caught); D is an early replay position. The `live` blocks are hand-authored.
- 45 cases: the original 40 plus 5 "Live context" cases. Stat-01/02 now expect an answer because the batter on strike has stats in `live`.
- `tests/ai.eval.test.ts` (runs under `npm test`, no network) is the deterministic half: exact router answers on fixtures A/D/E/B, explanations route to the LLM, unsupported/predictive questions never reach the provider, injection and leak shapes are blocked by the safety guard, live context is present in the prompt and an early replay prompt contains no later state, and extra provider-retry bounds (5xx, non-retryable 4xx, 3-call cap, 40 s budget).

## Final hard suite (`EVAL_SUITE=final`)

30 unique questions in 8 categories (statistical reasoning, momentum, player analysis, causal, live context, recent-ball interpretation, pressure/situation, premise correction). All 30 are routed to the LLM (checked by running the router over the fixtures); 23 expect an answer and 7 expect a premise correction. Expected facts are derived from `fixtures.ts` and the derivation is written next to each case. Each stored execution records the question, category, expected facts (assertion names), answer, status and failed assertions.

```bash
EVAL_SUITE=final EVAL_RUNS=1 EVAL_DELAY_MS=25000 npm run eval:ai
```

Pacing: Groq's limit on the key used is 8,000 tokens per minute and each call (prompt, context and reasoning tokens) uses a few thousand, so 4 s pacing hits 429s. 25 s pacing completes the suite with no provider errors (about 13 minutes). Provider errors, timeouts and parse errors stay separate from assertion failures, and a provider 429 is never counted as a wrong answer.

Known assertion limits (see the manual review in the root README): `noUngroundedNumbers` allows any number 0-12, `hasNum` matches a number anywhere in the answer, and `corrects` accepts generic negations, so a wrong small number or a vague correction can pass. Read the stored answers, not only the pass rate.
