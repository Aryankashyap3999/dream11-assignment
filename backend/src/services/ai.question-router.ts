import type { AIContext } from "../dto/ai.dto";

export type QuestionRoute = "DETERMINISTIC" | "LLM" | "UNSUPPORTED";
export type RoutedQuestion = { route: "LLM" } | { route: "DETERMINISTIC" | "UNSUPPORTED"; answer: string };

const REFUSAL = "I can only answer questions using the match information currently available.";
const OVERS_UNAVAILABLE = "The current over count isn't available right now.";

// Prompt-injection / internals, predictions, and data that is not in AIContext.
// ponytail: keyword matching, not an NLP classifier; unknown players / generic cricket facts fall through to the LLM (prompt-grounded + safety guard).
const UNSUPPORTED =
  /ignore (all |previous |the )|system prompt|\bprompts?\b|instruction|\bjson\b|\bcontext\b|\b(match|team|player|event|period)ids?\b|uuid|api key|reveal|predict|winner|\bwho will\b|\bwill \w+ win\b|going to win|(happen|happens) next|final score|\bwill\b.*\bscore\b|weather|\brain\b|\btoss\b|venue|stadium|pitch|career|history|historical|head to head|\bh2h\b|previous match|last match|other match|\bipl\b|world cup/;

// Anything asking for explanation/interpretation goes to the LLM, even if it also contains a factual lookup.
const LLM_CUE = /\b(why|explain|recap|summar\w*|matter\w*|import\w*|significan\w*|momentum|chang\w*|shift\w*|mean\w*|situation)\b/;

const LAST_SIX = /\b(last|recent|previous)\s+(6|six)\b|\blast over\b/;

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function teamName(context: AIContext): string {
  const id = context.analysis.situation.teamId;
  return context.match.teams.find((t) => t.id === id)?.name ?? "The batting side";
}

// Each intent returns its answer from supplied fields only; matched intents are collected so mixed questions can go to the LLM.
function lookups(q: string, context: AIContext): (() => string)[] {
  const { situation: s, recentForm: f, playerToWatch: p } = context.analysis;
  const team = teamName(context);
  const out: (() => string)[] = [];
  const last6 = LAST_SIX.test(q);

  if (/required (run ?rate|rr)|\brr\b|\brrr\b/.test(q))
    out.push(() => (s.requiredRunRate == null ? "The required run rate isn't available right now." : `The required run rate is ${s.requiredRunRate}.`));
  else if (!last6 && /\bruns?\b.*\b(need|needed|required|requires|left|to win)\b|\bneed\w*\b.*\bruns?\b|\bwhat\b.*\bneeds?\b/.test(q))
    out.push(() => (s.runsRequired == null ? "The runs required aren't available right now." : `${team} need ${count(s.runsRequired, "run")}.`));

  if (!last6 && /\b(balls?|deliveries)\b.*\b(left|remain\w*|to go)\b/.test(q))
    out.push(() => (s.ballsRemaining == null ? "The balls remaining aren't available right now." : `${team} have ${count(s.ballsRemaining, "ball")} remaining.`));

  if (!last6 && /\bscore\b/.test(q)) out.push(() => `${team} are ${s.runs}/${s.wickets}.`);

  if (last6) {
    if (/boundar/.test(q)) out.push(() => `The last six balls produced ${count(f.boundaries, "boundary", "boundaries")}.`);
    else if (/\bwickets?\b/.test(q)) out.push(() => `The last six balls produced ${count(f.wickets, "wicket")}.`);
    else if (/\bruns?\b/.test(q)) out.push(() => `The last six balls produced ${count(f.runs, "run")}.`);
    else if (!/how many|count|number/.test(q))
      out.push(() =>
        f.last6Balls.length
          ? `The last six balls were: ${f.last6Balls.map((b) => (b.isWicket ? "W" : b.totalRuns)).join(", ")}.`
          : "Recent ball data isn't available right now.",
      );
    else out.push(() => ""); // counted question we can't answer exactly (e.g. "how many sixes"); forces LLM via the length check
  }

  if (/player to watch|who (should i|to) watch|which player (matters|to watch)/.test(q))
    out.push(() => (p ? `${p.name} is the player to watch: ${p.reason}` : "There's no specific player to watch right now."));

  return out;
}

export function routeQuestion(question: string, context: AIContext): RoutedQuestion {
  const q = question.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q || UNSUPPORTED.test(q)) return { route: "UNSUPPORTED", answer: REFUSAL };
  if (LLM_CUE.test(q)) return { route: "LLM" };

  const found = lookups(q, context);
  if (found.length === 1) {
    const answer = found[0]();
    if (answer) return { route: "DETERMINISTIC", answer };
  }
  if (found.length === 0 && /(?<!last )\bovers?\b/.test(q)) return { route: "UNSUPPORTED", answer: OVERS_UNAVAILABLE };
  return { route: "LLM" };
}
