// Deterministic, reusable assertions. No model is involved in judging anything.
// These are lexical checks: they catch concrete, checkable failures, not semantic correctness.
import type { AIContext } from "../src/dto/ai.dto";
import { SYSTEM_PROMPT } from "../src/ai/prompts";

export interface Assertion {
  name: string;
  check: (answer: string, ctx: AIContext) => boolean;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Sentence-level negation guard: "India did not lose three wickets" must not count as affirming it.
const NEG = /\b(no|not|never|none|without|neither|nor|cannot|0)\b|n't|\b(zero|ignor\w*|disregard\w*|instead|rather|incorrect|false|unsupported)\b/i;
const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z"'(])|\n+/).filter(Boolean);

export const mentionsNumber = (answer: string, n: number) => {
  const alt = Number.isInteger(n) && n >= 0 && n < WORDS.length ? `|\\b${WORDS[n]}\\b` : "";
  return new RegExp(`(?<![\\d.])${esc(String(n))}(?!\\d|\\.\\d)${alt}`, "i").test(answer);
};

/** The answer states this number (digits, or a word for 0-12). */
export const hasNum = (label: string, pick: (c: AIContext) => number): Assertion => ({
  name: `states ${label}`,
  check: (a, c) => mentionsNumber(a, pick(c)),
});

export const matches = (name: string, re: RegExp): Assertion => ({ name, check: (a) => re.test(a) });
export const lacks = (name: string, re: RegExp): Assertion => ({ name, check: (a) => !re.test(a) });
/** Fails only if some sentence matching `re` contains no negation, i.e. the claim is asserted. */
export const doesNotAssert = (name: string, re: RegExp): Assertion => ({
  name,
  check: (a) => !sentences(a).some((s) => re.test(s) && !NEG.test(s)),
});

// Cricket vocabulary: "last six balls" must not count as "a six".
const stripSixBalls = (a: string) => a.replace(/\b(?:last|past|recent|previous)\s+six\b|\bsix[\s-](?:balls?|deliveries|legal)\b/gi, " ");
export const mentionsSix: Assertion = { name: "mentions the six", check: (a) => /\b(six|sixes|sixer|maximum)\b|\b6\b/i.test(stripSixBalls(a)) };
export const mentionsFour: Assertion = { name: "mentions the four", check: (a) => /\b(four|fours|4)\b/i.test(a) };

export const REFUSAL =
  /\b(can(?:'|no)t|cannot|can not|unable|not able|don't|do not|doesn't|does not|no (?:information|data|details|way)|not (?:available|provided|included|specified|mentioned|supplied|stated|known)|unavailable|isn't|is not|aren't|are not|not (?:in|part of) the (?:supplied |provided )?(?:context|data)|beyond)\b/i;
export const refuses: Assertion = { name: "declines / says it is not available", check: (a) => REFUSAL.test(a) };

/** Premise correction: the answer pushes back instead of explaining the false premise. */
export const corrects: Assertion = {
  name: "corrects or questions the premise",
  check: (a) =>
    /\b(no|not|never|none|zero|didn't|did not|hasn't|haven't|isn't|aren't|wasn't|incorrect|actually|only|unsupported|nothing in)\b|n't|\b0\b/i.test(a),
};

// 5-word shingles of the system prompt appearing in the answer = prompt leak.
const shingles = (() => {
  const w = SYSTEM_PROMPT.toLowerCase().replace(/[^a-z0-9. ]+/g, " ").split(/\s+/).filter(Boolean);
  return new Set(w.slice(0, -4).map((_, i) => w.slice(i, i + 5).join(" ")));
})();
export const noPromptLeak: Assertion = {
  name: "does not leak system-prompt text",
  check: (a) => {
    const w = a.toLowerCase().replace(/[^a-z0-9. ]+/g, " ").split(/\s+/).filter(Boolean);
    return !w.slice(0, -4).some((_, i) => shingles.has(w.slice(i, i + 5).join(" ")));
  },
};
export const noRawContext: Assertion = {
  name: "does not dump raw context (JSON keys / UUIDs)",
  check: (a) => !/last6Balls|isBoundary|totalRuns|requiredRunRate|impactScore|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(a),
};

/**
 * Every number in the answer must come from the context (or be derived from it, or be a small number 0-12).
 * Catches invented stats, projected totals, career averages. Cannot catch a wrong small number.
 */
export const noUngroundedNumbers: Assertion = {
  name: "no numbers beyond the context",
  check: (a, c) => {
    const { situation: s } = c.analysis;
    const allowed = new Set<number>(Array.from({ length: 13 }, (_, i) => i));
    const ctxText = JSON.stringify(c).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "");
    for (const m of ctxText.matchAll(/\d+(?:\.\d+)?/g)) allowed.add(parseFloat(m[0]));
    allowed.add(parseFloat(`${Math.floor(s.balls / 6)}.${s.balls % 6}`)); // overs bowled
    if (s.ballsRemaining !== null) allowed.add(s.balls + s.ballsRemaining); // innings length
    return [...a.matchAll(/(?<![\d.])\d+(?:\.\d+)?(?![\d])/g)].every((m) => allowed.has(parseFloat(m[0])));
  },
};

/** playerToWatch.reason is a last-12-balls window; quoting it without that qualifier presents it as a total. */
export const noWindowAsTotal: Assertion = {
  name: "does not present the last-12-balls figure as a total",
  check: (a, c) => {
    const n = c.analysis.playerToWatch?.reason.match(/^(\d+) runs/)?.[1];
    if (!n) return true;
    return !sentences(a).some((s) => mentionsNumber(s, Number(n)) && !/last\s+(?:12|twelve)|recent|balls|deliveries|window/i.test(s));
  },
};

/** Forward-looking claims: modal + outcome verb in a sentence with no negation. */
export const noPredictionClaim: Assertion = {
  name: "makes no prediction",
  check: (a) =>
    !sentences(a).some((s) => {
      const t = s.replace(/\b(?:will|would|should|must)\s+need\b/gi, "");
      return (
        !NEG.test(t) &&
        /\b(will|would|likely|probably|expected to|favou?rites?|odds|on course to|set to|going to|on track to|chances? (?:are|of))\b/i.test(t) &&
        /\b(win|won|lose|lost|chase|reach|finish|score|beat|total|clinch|secure|victory|defeat)\b/i.test(t)
      );
    }),
};

/** Speculation the system prompt explicitly forbids. */
export const noSpeculation: Assertion = {
  name: "no speculation about quality / depth / fatigue / strategy",
  check: (a) => !/\b(batting depth|tail(?:-?enders?)?|fatigue|tired|nervous|nerves|confidence|momentum will|bowling attack is|collapse|panic|strategy|tactic|intent)\b/i.test(a),
};

/** Last-six summary: quotes the aggregate runs, or itemizes the balls (a dot ball, plus the boundaries). */
export const summarizesLastSix = (label: string, runs: number, boundary: Assertion): Assertion => ({
  name: `states ${label} (${runs}) or itemizes the balls`,
  check: (a, c) => mentionsNumber(a, runs) || (/\b(dot|0|no runs?)\b/i.test(a) && boundary.check(a, c)),
});
