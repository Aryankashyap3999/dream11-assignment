# MatchPulse

MatchPulse is a live-cricket companion dashboard. For a match in progress it shows the score, the situation, momentum and the last six balls, and answers the question "what just changed?" with an AI-written insight. Fans can also ask free-text questions ("Ask MatchPulse"). The demo is a seeded T20I (India chasing 177 against Australia) that can be replayed ball by ball.

## Features

- Match list, match detail and scorecard.
- Deterministic match analysis: score, required run rate, balls remaining, last six balls, momentum, key moments, player to watch.
- Demo replay: start, pause and reset a ball-by-ball replay. Everything the app shows (scorecard, analysis, AI context) is limited to deliveries that have already "happened", so a replay never leaks future events.
- AI insight card: headline, what changed, why it matters, what to watch.
- Ask MatchPulse: factual questions (score, runs needed, required rate, balls left, last six balls, player to watch) are answered deterministically from the data without calling the model. Explanations go to the LLM. Predictions, internals and off-topic questions are refused.

## Architecture

```
React (Vite) --axios--> Express /api/v1 --> services --> Prisma ORM --> PostgreSQL
                                              |
                                              +--> AI provider (Groq or Gemini)
```

- **Frontend:** React 19, Vite, Tailwind 4, TanStack Query, React Router.
- **Backend:** Node 22, Express 5, TypeScript (run with `tsx`), Prisma 8 ORM, PostgreSQL 16.
- **AI pipeline** (`backend/src/services/ai.*`, `backend/src/ai/`): build a trusted context from the database (analysis plus current batter, bowler and latest event, all limited to replay-visible deliveries) -> question router (deterministic / LLM / refuse) -> provider call with bounded retry (3 attempts, 40 s budget) -> output-safety guard (blocks leaked ids, JSON and prompt text; one corrective retry) -> domain checks (score contradiction for insights, invented four/six counts for answers).
- **Provider errors:** quota or outage (429, 5xx, timeout, network) returns HTTP 503 with a friendly message; the frontend shows it.
- **Protection:** CORS limited by `FRONTEND_ORIGIN`; per-IP rate limit on the AI routes.

```
backend/   src/{ai,config,controllers,dto,middleware,prisma,routes/v1,services}
           tests/    unit tests plus DB-backed integration tests
           evals/    AI evaluation harness, cases, fixtures and stored results
           scripts/  seed-demo.ts
frontend/  src/{apis,components,config,hooks,pages,types,utils}
render.yaml          Render blueprint (backend + Postgres)
```

## Prerequisites

Node.js 22+, npm, Docker (for local PostgreSQL) or any PostgreSQL 16, and an API key for Groq or Gemini.

## Environment variables

Backend (`backend/.env`, copy from `backend/.env.example`):

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_PROVIDER` | `groq` or `gemini` |
| `AI_API_KEY` | Provider API key |
| `AI_MODEL` | Model name (the evaluated setup is `openai/gpt-oss-120b` on Groq) |
| `FRONTEND_ORIGIN` | Optional. Comma-separated allowed CORS origins. Unset = any origin (local development) |
| `AI_RATE_LIMIT_PER_MIN` | Optional. AI requests per IP per minute (default 20) |
| `REPLAY_INTERVAL_MS` | Optional. Replay step interval (default 2000) |
| `PORT` | Optional. Default 5000 |

Frontend (`frontend/.env`, copy from `frontend/.env.example`): `VITE_BACKEND_URL`, the backend base URL without `/api/v1`, for example `http://localhost:5000`.

## Run locally

```bash
# 1. PostgreSQL (host port 5434; credentials are in backend/docker-compose.yml)
cd backend && docker compose up -d

# 2. Backend config: set DATABASE_URL to that database, e.g. postgresql://<user>:<password>@localhost:5434/matchpulse
cp .env.example .env        # then fill in the values
npm install

# 3. Create the schema and load the demo match (both safe to re-run)
npx prisma db init
npm run db:seed

# 4. Backend on http://localhost:5000  (health check: /health)
npm run dev

# 5. Frontend on http://localhost:5173
cd ../frontend && cp .env.example .env && npm install && npm run dev
```

Production-style run of the backend: `npm run build && npm start`.

## API overview (`/api/v1`)

| Method and path | Description |
|---|---|
| `GET /matches`, `GET /matches/:id`, `GET /matches/:id/scorecard` | Matches and scorecard (limited to the replay position) |
| `GET /analysis/:id` | Situation, recent form, momentum, key moments, player to watch |
| `GET /ai/:id/insights` | AI insight (4 fields) |
| `POST /ai/:id/ask` with `{ "question": "..." }` | Ask MatchPulse |
| `GET /demo/:id`, `POST /demo/:id/start`, `/pause`, `/reset` | Replay state and controls |

Errors: 400 invalid id or body, 404 unknown match, 409 replay conflict, 429 rate limited, 503 AI provider unavailable or out of quota.

## Demo / replay

Open the seeded match and use the replay controls. Reset goes to the first delivery, Start advances one delivery every 2 seconds, Pause freezes the position. Score, scorecard, analysis and AI answers all follow the current position. With no replay session (fresh seed) the whole innings is visible: India 86/3, needing 91 off 55.

Note: the AI insight card is fetched once when the page loads and is not refreshed automatically as the replay moves (each insight is an LLM call). Use its Refresh button to generate one for the current position. The frontend does not poll insights, so there are no repeated insight requests and no server-side insight cache.

## AI provider configuration

Set `AI_PROVIDER` to `groq` (plain `fetch`, OpenAI-compatible API) or `gemini` (`@google/genai`), plus `AI_API_KEY` and `AI_MODEL`. Adding a provider means adding a case in `backend/src/ai/ai.provider.ts`. Groq's limit on the key used for the evaluation is 8,000 tokens per minute, roughly 2-3 LLM calls a minute, so rapid-fire questions can return 503 until the window resets.

## Tests

```bash
cd backend
npm test                       # 53 tests
npx tsc --noEmit && npx tsc --noEmit -p evals
cd ../frontend && npx tsc -b --noEmit && npm run build
```

`tests/api.integration.test.ts` runs against the seeded demo database (it is skipped if the database is unreachable or not seeded) and leaves the replay in the "no session" state.

## AI evaluation

```bash
cd backend
EVAL_SUITE=final EVAL_RUNS=1 EVAL_DELAY_MS=25000 npm run eval:ai   # 30 hard questions, ~13 minutes on Groq's free limit
npm run eval:ai                                                    # 45-case baseline suite
```

Results are saved to `backend/evals/results/` (question, category, expected facts, answer and status per execution). See `backend/evals/README.md` for the method. Assertions are deterministic and lexical (fixture-derived numbers present, forbidden claims absent); there is no LLM judge, and HTTP 200 is never treated as correct.

### Results

**Final suite, one run per question** (Groq, `openai/gpt-oss-120b`, 2026-11-04, file `ai-final-2026-11-04T16-25-34-303Z.json`). All 30 questions are LLM-routed. Sample size: 30 answers, 1 run each.

| | |
|---|---|
| Answered | 30 / 30 (0 provider errors, 0 timeouts, 0 parse errors) |
| Automated assertions | 24 pass, 6 fail (80%) |
| After manual review of all 30 answers | 21 correct (70%) |

| Category | Automated | After manual review |
|---|---|---|
| Statistical reasoning | 4/5 | 4/5 |
| Momentum | 2/3 | 2/3 |
| Player analysis | 3/4 | 3/4 |
| Causal | 3/3 | 2/3 |
| Live context | 3/3 | 2/3 |
| Recent-ball interpretation | 4/4 | 4/4 |
| Pressure/situation | 3/3 | 2/3 |
| Premise correction | 2/5 | 2/5 |

Manual review of every answer against its fixture:

- The 6 assertion failures contain no false facts. They are over-cautious answers: the model said "the context does not provide it" for strike rate (`f-play-01`) and economy rate (`f-stat-04`) although the inputs (41 off 30; 2 overs, 17 runs, 2 wickets) were in the context. The system prompt forbids recalculating statistics, which encourages this. In three premise-correction questions (`f-prem-01`, `f-prem-02`, `f-prem-05`) and `f-mom-03` the model declined to affirm the false premise but did not state the correct fact.
- Three answers passed the assertions but are wrong: `f-live-01` says the wicket leaves India on "61/4" (fixture: 61/3), `f-cause-03` calls momentum of -15 a "negative swing in their favour" (it is against India), `f-press-03` says Australia are "in their chase" (first innings, no target). The assertions do not catch them because `noUngroundedNumbers` accepts any number 0-12 and `corrects` accepts generic negations. This is a known weakness of lexical assertions and the suite was not edited after seeing results.

**Baseline before the router and safety guard** (40 cases x 3 runs, raw prompt, `ai-baseline-2026-11-02T14-36-57-484Z.json`): 111 of 115 answered executions passed (96.5%); 4 provider errors and 1 timeout were not counted as quality failures.

**What this does and does not show.** The model never fabricated a player, number from outside the context or a prediction in 30 answers, but it made 3 factual slips and over-refuses derived statistics. 30 single-run answers is a small sample, and the two earlier final-suite runs (2026-11-02) are almost entirely HTTP 429 provider errors (the 4 s pacing exceeded Groq's 8,000 tokens/minute) and carry no quality signal. AI quality is reasonable but not proven at scale. Two follow-ups: let the prompt allow quoting simple derived figures from supplied numbers, and add wicket-count and direction checks to the assertions.

## Deployment

**Status: not deployed.** No Render or Vercel account access was available when this was prepared, so there is no live URL.

Verified locally: both production builds pass; `npm start` against a fresh database initialised with `prisma db init` and `db:seed` serves every endpoint, enforces `FRONTEND_ORIGIN` and the rate limit.

To deploy:

1. **Backend + database (Render):** New -> Blueprint -> this repo (uses `render.yaml`). Set `AI_API_KEY` and, after step 2, `FRONTEND_ORIGIN` (the Vercel URL). The start command runs `prisma db init` and the seed on each start (both idempotent; the seed recreates the demo match and resets its replay). If your Postgres requires TLS, append `?sslmode=require` to `DATABASE_URL`. Check `https://<backend>/health`.
2. **Frontend (Vercel):** import the repo with root directory `frontend`, set `VITE_BACKEND_URL` to the Render URL, deploy. `frontend/vercel.json` makes deep links work.
3. Smoke-test: match list, match page, scorecard, replay start/pause/reset, an insight and a question.

Render's free web service sleeps when idle, so the first request after a pause is slow.

## Known limitations

- Provider quota: bursts of questions can return 503 on Groq's free limits.
- The insight card refreshes only on page load or via its Refresh button, not while the replay moves (see Demo / replay).
- Replay timers live in the server process: single instance only.
- The question router is keyword based; the safety and validation checks are narrow patterns, not a general hallucination detector.
