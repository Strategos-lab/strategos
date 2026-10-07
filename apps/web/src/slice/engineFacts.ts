/**
 * The only place the slice touches game logic. Every fact shown to the learner (opponent draw,
 * outcome cell, payoffs, best replies, dominance, consistency) comes from @strategos/engine here;
 * components and content only render these results.
 */
import {
  Rational,
  bestResponseTable,
  deriveSeed,
  dominance,
  initialState,
  internalConsistency,
  isTerminal,
  nextBernoulli,
  normaliseSeed,
  paretoAnalysis,
  payoffs as enginePayoffs,
  seedRng,
  step,
  type NormalState,
  type Profile,
} from '@strategos/engine';
import type { Scenario, StructuredQuestion } from '../content/schema';

export const LEARNER = 0 as const;
export const OPPONENT = 1 as const;

export const learnerActions = (s: Scenario) => s.game.players[LEARNER]!.actions;
export const opponentActions = (s: Scenario) => s.game.players[OPPONENT]!.actions;
export const learnerLabel = (s: Scenario) => s.game.players[LEARNER]!.label;
export const opponentLabel = (s: Scenario) => s.game.players[OPPONENT]!.label;

/**
 * Draw the opponent's action from the scenario's declared fixed mixed policy, using the engine's
 * seeded PRNG (stream `rngStream` derived from the attempt seed). Pure: same seed ⇒ same action.
 * Sampling uses exact rational conditional Bernoulli draws: P(i | not earlier) = p_i / remaining.
 */
export function sampleOpponentAction(s: Scenario, seed: number): number {
  const ids = opponentActions(s).map((a) => a.id);
  const probs = ids.map((id) => Rational.parse(s.opponentPolicy.probabilities[id]!));
  let rng = seedRng(deriveSeed(seed, s.opponentPolicy.rngStream));
  let remaining = Rational.ONE;
  for (let i = 0; i < ids.length - 1; i++) {
    const p = probs[i]!;
    if (!p.isZero()) {
      const conditional = p.div(remaining);
      const d = nextBernoulli(rng, conditional.gt(1) ? Rational.ONE : conditional);
      rng = d.state;
      if (d.value) return i;
    }
    remaining = remaining.sub(p);
    if (remaining.isZero()) break;
  }
  // Last action with positive probability.
  for (let i = ids.length - 1; i >= 0; i--) if (!probs[i]!.isZero()) return i;
  return ids.length - 1;
}

export interface ResolvedOutcome {
  profile: Profile;
  /** [learner payoff, opponent payoff] as rational strings. */
  payoffs: [string, string];
}

/** Resolve the outcome cell by running the engine's game state machine. */
export function resolveOutcome(s: Scenario, learnerAction: number, opponentAction: number): ResolvedOutcome {
  let st = initialState(s.game);
  st = step(s.game, st, { player: LEARNER, action: learnerAction });
  st = step(s.game, st, { player: OPPONENT, action: opponentAction });
  if (!isTerminal(s.game, st)) throw new Error('outcome not terminal');
  const chosen = (st as NormalState).chosen;
  const p = enginePayoffs(s.game, st);
  return { profile: [chosen[0]!, chosen[1]!], payoffs: [p[0]!.toString(), p[1]!.toString()] };
}

/** Learner's payoff for every own action against one opponent action, plus the best set (engine). */
export function bestReplyFacts(s: Scenario, opponentAction: number): { payoffs: string[]; best: number[] } {
  const row = bestResponseTable(s.game, LEARNER)[opponentAction]!;
  return { payoffs: row.payoffs.map((p) => p.toString()), best: row.best };
}

/** Learner's strictly dominant action (better whatever the opponent does), or null (engine). */
export function dominantAction(s: Scenario, player: 0 | 1 = LEARNER): number | null {
  return dominance(s.game, player).strictlyDominantAction;
}

export const NONE_OPTION = '__none__';

export interface QuestionOption {
  id: string;
  label: string;
}

export function questionOptions(s: Scenario, q: StructuredQuestion): QuestionOption[] {
  const own = learnerActions(s);
  if (q.kind !== 'dominant-action') return own.map((a) => ({ id: a.id, label: a.label }));
  const actionOpts = own.map((a) => ({
    id: a.id,
    label: q.alwaysLabel ? fillTemplate(q.alwaysLabel, { action: a.label }) : a.label,
  }));
  return [...actionOpts, { id: NONE_OPTION, label: q.noneLabel }];
}

/** Correct option ids for a structured question, derived from engine outputs only. */
export function correctOptions(s: Scenario, q: StructuredQuestion): string[] {
  const own = learnerActions(s);
  if (q.kind === 'best-reply') {
    const opp = opponentActions(s).findIndex((a) => a.id === q.opponentAction);
    return bestReplyFacts(s, opp).best.map((i) => own[i]!.id);
  }
  const d = dominantAction(s);
  return [d === null ? NONE_OPTION : own[d]!.id];
}

/** Fill "{name}" placeholders. Unknown placeholders are left visible so tests catch them. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k]! : m));
}

/** "Leave it gives you 5; Clean gives you 3." (engine values, best first). */
export function comparisonLine(s: Scenario, opponentAction: number): string {
  const own = learnerActions(s);
  const { payoffs } = bestReplyFacts(s, opponentAction);
  const order = own
    .map((_, i) => i)
    .sort((a, b) => Rational.parse(payoffs[b]!).cmp(Rational.parse(payoffs[a]!)) || a - b);
  const ranked = order
    .map((i) => fillTemplate(s.feedback.rankedItem, { action: own[i]!.label, payoff: payoffs[i]! }))
    .join('; ');
  return fillTemplate(s.feedback.line, { opponentAction: opponentActions(s)[opponentAction]!.label, ranked });
}

export function questionFeedback(s: Scenario, q: StructuredQuestion, answer: string): { correct: boolean; text: string } {
  const own = learnerActions(s);
  const correctIds = correctOptions(s, q);
  const correct = correctIds.includes(answer);
  if (q.kind === 'best-reply') {
    const opp = opponentActions(s).findIndex((a) => a.id === q.opponentAction);
    const { best } = bestReplyFacts(s, opp);
    const values = {
      lines: comparisonLine(s, opp),
      opponentAction: opponentActions(s)[opp]!.label,
      best: best.map((i) => own[i]!.label).join(' / '),
    };
    const tpl = best.length > 1 ? s.feedback.bestReplyTie : correct ? s.feedback.bestReplyCorrect : s.feedback.bestReplyIncorrect;
    return { correct, text: fillTemplate(tpl, values) };
  }
  const d = dominantAction(s);
  // One evidence statement (joined with an em dash) so the headline stays evidence-first.
  const lines =
    opponentActions(s)
      .map((_, j) => comparisonLine(s, j).replace(/\.$/, ''))
      .join(' — ') + '.';
  const values = { lines, dominant: d === null ? '' : own[d]!.label };
  const tpl =
    d === null
      ? correct
        ? s.feedback.noneCorrect
        : s.feedback.noneIncorrect
      : correct
        ? s.feedback.dominantCorrect
        : s.feedback.dominantIncorrect;
  return { correct, text: fillTemplate(tpl, values) };
}

/**
 * Closing remark, only when the engine finds a strictly dominant action for BOTH players and the
 * resulting joint outcome is Pareto-dominated by another cell. Returns null otherwise.
 */
export function closingNote(s: Scenario): string | null {
  if (!s.closingNote) return null;
  const a = dominantAction(s, LEARNER);
  const b = dominantAction(s, OPPONENT);
  if (a === null || b === null) return null;
  const pa = paretoAnalysis(s.game);
  const cell = pa.outcomes.find((o) => o.profile[0] === a && o.profile[1] === b)!;
  const better = cell.dominatedBy[0];
  if (!better) return null;
  const betterCell = pa.outcomes.find((o) => o.profile[0] === better[0] && o.profile[1] === better[1])!;
  return fillTemplate(s.closingNote, {
    dominant: learnerActions(s)[a]!.label,
    mutualYou: cell.payoffs[0].toString(),
    mutualThem: cell.payoffs[1].toString(),
    betterYou: betterCell.payoffs[0].toString(),
    betterThem: betterCell.payoffs[1].toString(),
  });
}

export interface ConsistencyFact {
  /** Learner's belief as rational strings over the opponent's actions. */
  belief: string[];
  consistent: boolean;
  /** Best replies to the learner's own stated belief. */
  best: number[];
}

/**
 * Decision consistency: was the choice a best reply to the learner's OWN prediction? The belief is
 * the stated confidence on the predicted action, with the rest spread evenly over the others.
 * Judged by the engine's internalConsistency; the realised opponent action is never an input.
 */
export function decisionConsistency(s: Scenario, prediction: number, confidencePct: number, choice: number): ConsistencyFact {
  const n = opponentActions(s).length;
  const c = Rational.of(confidencePct, 100);
  const rest = n > 1 ? Rational.ONE.sub(c).div(n - 1) : Rational.ZERO;
  const belief = Array.from({ length: n }, (_, j) => (j === prediction ? c : rest));
  const ic = internalConsistency(s.game, LEARNER, belief, choice);
  return { belief: belief.map((b) => b.toString()), consistent: ic.consistent, best: ic.best };
}

let seedCounter = 0;
/** A fresh attempt seed (unsigned 32-bit), derived with the engine’s seed mixer (no unseeded randomness). */
export function freshSeed(now: number = Date.now()): number {
  seedCounter += 1;
  return deriveSeed(now, seedCounter);
}

/** Parse a seed given in the URL (?seed=…) for reproducible replays; null if absent/invalid. */
export function parseSeed(raw: string | null): number | null {
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  return normaliseSeed(Number(raw));
}
