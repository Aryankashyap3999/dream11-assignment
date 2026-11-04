// Final hard suite: 30 unique, LLM-routed questions that need arithmetic, interpretation or premise correction.
// Select with EVAL_SUITE=final. Expected facts come from fixtures.ts only; see the derivation next to each case.
import type { AIContext } from "../src/dto/ai.dto";
import {
  type Assertion, corrects, doesNotAssert, hasNum, matches, mentionsFour, mentionsSix, noPredictionClaim,
  noRawContext, noSpeculation, noUngroundedNumbers, summarizesLastSix,
} from "./assertions";
import type { EvalCase } from "./cases";

export const FINAL_CATEGORIES = [
  "Statistical reasoning", "Momentum", "Player analysis", "Causal", "Live context", "Recent-ball interpretation", "Pressure/situation", "Premise correction",
] as const;

export type FinalCase = Omit<EvalCase, "category"> & { category: (typeof FINAL_CATEGORIES)[number] };

const c = (
  id: string, category: FinalCase["category"], fixture: FinalCase["fixture"], question: string,
  expectedBehavior: FinalCase["expectedBehavior"], assertions: Assertion[],
): FinalCase => ({ id, category, fixture, question, expectedBehavior, assertions });

const n = (label: string, v: number) => hasNum(label, (_: AIContext) => v);

export const FINAL_CASES: FinalCase[] = [
  // Statistical reasoning
  // A: 86 runs off 65 balls = 7.93 rpo vs required 9.93.
  c("f-stat-01", "Statistical reasoning", "A", "Explain how far India's scoring pace so far is from the rate they now need.", "ANSWER",
    [n("required rate 9.93", 9.93), matches("says current pace is lower (7.9 / below / behind)", /7\.9|7\.8|\b(below|behind|lower|slower|short|less than|under)\b/i)]),
  // A: batter 41 (30), 4 fours + 2 sixes = 28 off boundaries, 13 otherwise.
  c("f-stat-02", "Statistical reasoning", "A", "Aarav Sharma has 4 fours and 2 sixes in his 41. Explain how many of his runs came from boundaries and how many from elsewhere.", "ANSWER",
    [n("boundary runs 28", 28), n("other runs 13", 13)]),
  // A: latest 13 runs include the four and six = 10.
  c("f-stat-03", "Statistical reasoning", "A", "Explain what share of India's most recent 13 runs came off the four and the six together.", "ANSWER",
    [n("four + six = 10", 10), n("of 13", 13)]),
  // E: Holloway 2 overs, 17 runs, 2 wickets = economy 8.5.
  c("f-stat-04", "Statistical reasoning", "E", "Explain what the current bowler's economy rate is and what it says about his spell.", "ANSWER",
    [n("economy 8.5", 8.5), n("17 runs", 17), n("2 wickets", 2)]),
  // D: needs 9.19 per over; scored 33 off 4.2 overs = 7.6 per over.
  c("f-stat-05", "Statistical reasoning", "D", "Explain what India need per over from here, compared with how they have scored so far.", "ANSWER",
    [n("required rate 9.19", 9.19), matches("states current pace (7.6 / 7.7 / 33 off 26 balls) or lower", /7\.[5-9]|\b(below|behind|lower|slower|short|less than|under)\b|33/i), noPredictionClaim]),

  // Momentum
  // A: momentum 28 POSITIVE, but 91 needed off 55 balls.
  c("f-mom-01", "Momentum", "A", "Does a momentum score of 28 mean India are favourites? Explain.", "ANSWER",
    [n("momentum 28", 28), doesNotAssert("does not call India favourites", /favou?rites?/i), noPredictionClaim]),
  // E: momentum -15 NEGATIVE (against India) after the wicket.
  c("f-mom-02", "Momentum", "E", "Explain what the momentum score is after the wicket and who it favours.", "ANSWER",
    [matches("states -15 / 15", /-\s?15|\b15\b/), matches("says negative / against India / favours Australia", /negative|against India|favou?rs? Australia|Australia/i), doesNotAssert("does not call it positive", /\bpositive\b/i)]),
  // B: momentum -12 NEGATIVE but 52/1: no collapse.
  c("f-mom-03", "Momentum", "B", "Australia's momentum is -12 here. Does that mean they are collapsing?", "CORRECT_PREMISE",
    [corrects, matches("cites 52/1 or one wicket", /52|\b(one|1) wicket|1\/52|52\/1/i),
      doesNotAssert("does not affirm a collapse", /\bAustralia\b[^.]*\b(is|are|were|have been|is in|are in)\b[^.]*\bcollaps\w*\b/i)]),

  // Player analysis
  // A: Aarav 41 off 30 = SR 136.67.
  c("f-play-01", "Player analysis", "A", "What is Aarav Sharma's strike rate in this innings?", "ANSWER",
    [matches("136.7 / 136.67 / 137 (or 41 off 30)", /136\.?\d*|137|41 (runs )?(off|from) 30/)]),
  // A: Carter 2-0-24-1 = 12 per over.
  c("f-play-02", "Player analysis", "A", "Liam Carter took a wicket. Has he also been expensive?", "ANSWER",
    [n("24 runs", 24), n("12 per over", 12), n("2 overs", 2)]),
  // E: caught Oscar Hayes b Holloway; Nair 14 (11). The question asks who and balls faced, not runs.
  c("f-play-03", "Player analysis", "E", "Kabir Nair got out. Who dismissed him and how many balls had he faced?", "ANSWER",
    [matches("Jack Holloway", /Jack Holloway/), matches("Oscar Hayes", /Oscar Hayes/), matches("caught", /\bcaught\b/i), n("11 balls", 11)]),
  // A: Aarav is India, bowler is Liam Carter.
  c("f-play-04", "Player analysis", "A", "Which side does the batter on strike play for, and who is bowling to him?", "ANSWER",
    [matches("India", /\bIndia\b/), matches("Liam Carter", /Liam Carter/), doesNotAssert("not Australia batter", /Aarav[^.]*plays? for Australia/i)]),

  // Causal (must stay grounded in the supplied numbers)
  // D: momentum +20 while 144 still needed: the six and 11 runs recently.
  c("f-cause-01", "Causal", "D", "Explain why momentum is positive here even though India still need a lot.", "ANSWER",
    [n("momentum 20", 20), matches("cites the recent six / boundary / 11 runs", /\bsix\b|boundar|\b11\b|eleven/i), noSpeculation, doesNotAssert("no later-match state", /\b(86|91)\b/)]),
  // A: 91 off 55 balls = 9.93.
  c("f-cause-02", "Causal", "A", "Explain what is driving India's required run rate up to this level.", "ANSWER",
    [n("91 runs", 91), n("55 balls", 55), n("9.93", 9.93), noSpeculation, noPredictionClaim]),
  // E: 116 off 68 = 10.24.
  c("f-cause-03", "Causal", "E", "Explain why the situation is hard for India after that wicket.", "ANSWER",
    [n("10.24", 10.24), n("116 needed", 116), noUngroundedNumbers, noSpeculation, noPredictionClaim]),

  // Live context
  // E: wicket, Nair c Hayes b Holloway, 0 runs.
  c("f-live-01", "Live context", "E", "Describe the latest ball in full detail.", "ANSWER",
    [matches("Kabir Nair", /Kabir Nair/), matches("caught", /\bcaught\b/i), matches("Oscar Hayes", /Oscar Hayes/), matches("Jack Holloway", /Jack Holloway/), noSpeculation, noRawContext]),
  // D: Holloway 1-0-9-0.
  c("f-live-02", "Live context", "D", "Who is bowling right now and how has he gone so far?", "ANSWER",
    [matches("Jack Holloway", /Jack Holloway/), n("9 runs", 9), doesNotAssert("does not give him a wicket", /\b(1|one) wicket\b/i), noUngroundedNumbers]),
  // C: only one ball bowled: 1 run, Holloway, Vikram Rao.
  c("f-live-03", "Live context", "C", "Explain what has happened in this match so far.", "ANSWER",
    [matches("Jack Holloway", /Jack Holloway/), n("1 run", 1), doesNotAssert("no wicket / boundary invented", /\b(wicket|four|six|boundary)\b/i), noUngroundedNumbers]),

  // Recent-ball interpretation
  // A: 1,0,1(wide),4,6,1 = 13.
  c("f-ball-01", "Recent-ball interpretation", "A", "Explain what the sequence of recent deliveries says about how India are scoring.", "ANSWER",
    [summarizesLastSix("runs in recent balls", 13, mentionsSix), mentionsFour, mentionsSix, doesNotAssert("no wicket asserted", /\bwicket/i)]),
  // E: 1,0,4,1,0,W = 6 runs, final ball a wicket.
  c("f-ball-02", "Recent-ball interpretation", "E", "Summarize the recent six deliveries and tell me what the final ball was.", "ANSWER",
    [matches("final ball a wicket", /wicket|\bout\b|dismiss|caught/i), n("6 runs", 6), mentionsFour]),
  // D: wicket at 1.3, six at 3.3, so the six came after the wicket; recent window has no wicket.
  c("f-ball-03", "Recent-ball interpretation", "D", "Did the six come before or after India's wicket? Explain using the key moments.", "ANSWER",
    [matches("says after / later", /\b(after|later|followed|subsequent)\b/i), matches("cites an over (1.3 or 3.3)", /1\.3|3\.3/)]),
  // B: dots: 0 and 0 = 2 in 1,0,4,1,0,2.
  c("f-ball-04", "Recent-ball interpretation", "B", "Explain how many dot balls there were in Australia's recent six deliveries.", "ANSWER",
    [n("2 dot balls", 2), doesNotAssert("no wicket asserted", /\bwicket\b[^.]*\b(fell|taken|lost)\b/i)]),

  // Pressure / situation
  // A: RRR 9.93, 91 off 55.
  c("f-press-01", "Pressure/situation", "A", "Explain how much pressure India are under, given the asking rate and balls left.", "ANSWER",
    [n("9.93", 9.93), n("91", 91), n("55", 55), noSpeculation, noPredictionClaim]),
  // D: 144 off 94 balls, RRR 9.19, 1 wicket down = 9 in hand.
  c("f-press-02", "Pressure/situation", "D", "Explain the situation: how many wickets does India have in hand and what is the asking rate?", "ANSWER",
    [n("9.19", 9.19), matches("9 wickets in hand (or 1 down)", /\b(9|nine) wickets|\b(1|one) wicket (down|lost)|lost (only )?(1|one) wicket/i), noPredictionClaim]),
  // B: no target in a first innings; premise of a chase is false.
  c("f-press-03", "Pressure/situation", "B", "What is the situation for Australia given the target they are chasing?", "CORRECT_PREMISE",
    [corrects, n("52", 52), doesNotAssert("does not invent a target", /\btarget (of|is) \d|chas\w+ \d{3}/i)]),

  // Premise correction
  // A: RRR is 9.93, not below 8.
  c("f-prem-01", "Premise correction", "A", "Why did India's required rate drop below 8 after the six?", "CORRECT_PREMISE",
    [corrects, n("actual 9.93", 9.93), doesNotAssert("does not affirm a drop below 8", /\b(drop\w*|fell|fall\w*|reduc\w*|dipp\w*)\b[^.]*\bbelow (8|eight)\b/i)]),
  // E: Kabir Nair was out, not Aarav.
  c("f-prem-02", "Premise correction", "E", "Why did Aarav Sharma get out?", "CORRECT_PREMISE",
    [corrects, matches("names Kabir Nair", /Kabir Nair/), doesNotAssert("does not say Aarav was dismissed", /Aarav Sharma[^.]*\b(dismissed|caught|got out|was out|fell)\b/i)]),
  // A: Carter has bowled 2 overs, not 3.
  c("f-prem-03", "Premise correction", "A", "Explain why Liam Carter conceded 24 runs in his 3 overs.", "CORRECT_PREMISE",
    [corrects, n("2 overs", 2), n("24 runs", 24), doesNotAssert("does not affirm 3 overs", /\b(3|three) overs\b/i)]),
  // C: 1/0, no wicket.
  c("f-prem-04", "Premise correction", "C", "Why did Australia lose a wicket so early in the innings?", "CORRECT_PREMISE",
    [corrects, doesNotAssert("does not affirm a wicket", /\b(lost|lose|losing|fell|fall)\b[^.]*\bwicket\b/i), noUngroundedNumbers]),
  // D: one six only (3.3); Aarav has 1 six.
  c("f-prem-05", "Premise correction", "D", "Why did India hit three sixes in the last few overs?", "CORRECT_PREMISE",
    [corrects, matches("one six", /\b(one|1|a single|single) six\b|\bonly (one|1)\b/i), doesNotAssert("does not affirm three sixes", /\b(three|3) sixes\b/i)]),
];
