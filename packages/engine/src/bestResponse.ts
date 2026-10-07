/** Best responses (to pure actions and to mixed beliefs), with exact ties. */
import { compile, ownMatrix, assertPlayer, assertAction, actionCount, toDistribution, type MatrixGame } from './compile.js';
import { argmaxAll, dot, type Rational, type RationalLike } from './rational.js';

/** All best responses of `player` to the opponent's pure action (ties included, ascending). */
export function bestResponses(game: MatrixGame, player: number, opponentAction: number): number[] {
  assertPlayer(player);
  const bm = compile(game);
  assertAction(bm, player === 0 ? 1 : 0, opponentAction);
  const U = ownMatrix(bm, player);
  return argmaxAll(U.map((row) => row[opponentAction]!));
}

export interface BestResponseRow {
  opponentAction: number;
  /** Own payoff of each own action against this opponent action. */
  payoffs: Rational[];
  best: number[];
  bestValue: Rational;
}

/** For each opponent action: own payoffs and the best-response set. */
export function bestResponseTable(game: MatrixGame, player: number): BestResponseRow[] {
  assertPlayer(player);
  const bm = compile(game);
  const U = ownMatrix(bm, player);
  const k = actionCount(bm, player === 0 ? 1 : 0);
  const rows: BestResponseRow[] = [];
  for (let s = 0; s < k; s++) {
    const payoffs = U.map((row) => row[s]!);
    const best = argmaxAll(payoffs);
    rows.push({ opponentAction: s, payoffs, best, bestValue: payoffs[best[0]!]! });
  }
  return rows;
}

export interface MixedBestResponse {
  /** Exact expected payoff of each own action under the opponent mix. */
  expected: Rational[];
  best: number[];
  value: Rational;
}

/** Best responses to a probability distribution over the opponent's actions (exact expected payoffs). */
export function bestResponseToMixed(game: MatrixGame, player: number, opponentMix: readonly RationalLike[]): MixedBestResponse {
  assertPlayer(player);
  const bm = compile(game);
  const mix = toDistribution(opponentMix, actionCount(bm, player === 0 ? 1 : 0), 'opponentMix');
  const U = ownMatrix(bm, player);
  const expected = U.map((row) => dot(row, mix));
  const best = argmaxAll(expected);
  return { expected, best, value: expected[best[0]!]! };
}
