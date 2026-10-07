/**
 * Decision quality vs outcome quality (plan §2.7).
 *
 * Decision quality is judged ONLY against information the user had: a declared
 * prior over the opponent's actions (or the user's own stated prediction). These
 * functions take no realised opponent action, so hindsight cannot leak in.
 * Outcome quality (what actually happened) is computed separately and must never
 * be used to judge the decision.
 */
import { compile, ownMatrix, assertPlayer, assertAction, actionCount, toDistribution, type MatrixGame } from './compile.js';
import { solveEquilibria, type EquilibriumSet } from './equilibria.js';
import { argmaxAll, dot, maxOf, minOf, type Rational, type RationalLike } from './rational.js';
import type { Profile } from './types.js';

export type DecisionClassification = 'best' | 'tied best' | 'not best';

export interface DecisionQuality {
  basis: 'declared-prior' | 'own-prediction';
  player: 0 | 1;
  chosen: number;
  /** Exact expected payoff of each own action under the belief. */
  expected: Rational[];
  best: number[];
  bestValue: Rational;
  chosenValue: Rational;
  /** bestValue - chosenValue (>= 0). */
  regret: Rational;
  /** regret / (bestValue - worstValue): 0 = best available, 1 = worst; null if all actions tie. */
  normalisedRegret: Rational | null;
  classification: DecisionClassification;
  /**
   * Expected values are meaningful only for cardinal payoffs, or when the belief puts
   * probability 1 on a single opponent action. When false, consumers must not show
   * numeric expected-value feedback (ordinal payoffs, plan §2.6).
   */
  expectedValuesMeaningful: boolean;
}

function evaluate(
  game: MatrixGame,
  player: number,
  belief: readonly RationalLike[],
  chosen: number,
  basis: DecisionQuality['basis'],
): DecisionQuality {
  assertPlayer(player);
  const bm = compile(game);
  assertAction(bm, player, chosen);
  const dist = toDistribution(belief, actionCount(bm, player === 0 ? 1 : 0), basis === 'declared-prior' ? 'prior' : 'prediction');
  const U = ownMatrix(bm, player);
  const expected = U.map((row) => dot(row, dist));
  const best = argmaxAll(expected);
  const bestValue = maxOf(expected);
  const worst = minOf(expected);
  const chosenValue = expected[chosen]!;
  const regret = bestValue.sub(chosenValue);
  const span = bestValue.sub(worst);
  const isBest = best.includes(chosen);
  return {
    basis,
    player,
    chosen,
    expected,
    best,
    bestValue,
    chosenValue,
    regret,
    normalisedRegret: span.isZero() ? null : regret.div(span),
    classification: !isBest ? 'not best' : best.length > 1 ? 'tied best' : 'best',
    expectedValuesMeaningful: game.payoffScale === 'cardinal' || dist.filter((p) => !p.isZero()).length === 1,
  };
}

/** Decision quality of `chosen` under the scenario's declared prior over the opponent's actions. */
export function decisionQuality(game: MatrixGame, player: number, prior: readonly RationalLike[], chosen: number): DecisionQuality {
  return evaluate(game, player, prior, chosen, 'declared-prior');
}

export interface InternalConsistency extends DecisionQuality {
  /** Did the user best-respond to their own stated prediction? */
  consistent: boolean;
}

/** Internal consistency: was the decision a best response to the user's OWN stated prediction? */
export function internalConsistency(
  game: MatrixGame,
  player: number,
  statedPrediction: readonly RationalLike[],
  chosen: number,
): InternalConsistency {
  const dq = evaluate(game, player, statedPrediction, chosen, 'own-prediction');
  return { ...dq, consistent: dq.classification !== 'not best' };
}

export interface OutcomeQuality {
  basis: 'realised-outcome';
  player: 0 | 1;
  realised: Profile;
  realisedPayoff: Rational;
  /** Own payoffs of every own action against the realised opponent action (hindsight). */
  againstRealised: Rational[];
  hindsightBest: number[];
  hindsightRegret: Rational;
  /** Own worst and best payoff anywhere in the game, for scale. */
  gameMin: Rational;
  gameMax: Rational;
}

/** Outcome quality: what the realised outcome paid. Hindsight only; never a judgement of the decision. */
export function outcomeQuality(game: MatrixGame, player: number, realised: Profile): OutcomeQuality {
  assertPlayer(player);
  const bm = compile(game);
  assertAction(bm, 0, realised[0]);
  assertAction(bm, 1, realised[1]);
  const U = ownMatrix(bm, player);
  const own = realised[player];
  const opp = realised[1 - player]!;
  const againstRealised = U.map((row) => row[opp]!);
  const best = argmaxAll(againstRealised);
  return {
    basis: 'realised-outcome',
    player,
    realised,
    realisedPayoff: againstRealised[own]!,
    againstRealised,
    hindsightBest: best,
    hindsightRegret: againstRealised[best[0]!]!.sub(againstRealised[own]!),
    gameMin: minOf(U.flat()),
    gameMax: maxOf(U.flat()),
  };
}

export interface EquilibriumReference {
  player: 0 | 1;
  chosen: number;
  /** Chosen action is player's action in some pure NE. */
  inSomePureEquilibrium: boolean;
  /** Chosen action is played with positive probability in some NE (pure or mixed). */
  inSupportOfSomeEquilibrium: boolean;
}

/** Equilibrium reference point (plan §2.7): is the chosen action part of any equilibrium? */
export function equilibriumReference(
  game: MatrixGame,
  player: number,
  chosen: number,
  eq: EquilibriumSet = solveEquilibria(game),
): EquilibriumReference {
  assertPlayer(player);
  assertAction(compile(game), player, chosen);
  return {
    player,
    chosen,
    inSomePureEquilibrium: eq.pure.some((p) => p[player] === chosen),
    // Any NE is a convex combination of extreme equilibria within a Nash subset, so an action has
    // positive probability in some NE iff it does in some extreme equilibrium.
    inSupportOfSomeEquilibrium: eq.extremeEquilibria.some((mp) => !mp[player]![chosen]!.isZero()),
  };
}
