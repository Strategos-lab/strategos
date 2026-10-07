/**
 * Internal compiled form of a two-player matrix game: payoff matrices as Rationals.
 * Compilation validates once and is cached per game object (games are treated as immutable).
 */
import { Rational, type RationalLike } from './rational.js';
import type { NormalGame, Player, Profile, Sequential2Game } from './types.js';
import { assertValidGame, GameValidationError } from './validate.js';

export interface Bimatrix {
  /** Number of actions of player 0 (rows). */
  readonly m: number;
  /** Number of actions of player 1 (columns). */
  readonly n: number;
  /** Player 0 payoffs, A[i][j]. */
  readonly A: Rational[][];
  /** Player 1 payoffs, B[i][j]. */
  readonly B: Rational[][];
}

export type MatrixGame = NormalGame | Sequential2Game;

const cache = new WeakMap<object, Bimatrix>();

export function compile(game: MatrixGame): Bimatrix {
  const hit = cache.get(game);
  if (hit) return hit;
  assertValidGame(game);
  if (game.kind !== 'normal' && game.kind !== 'sequential2') {
    throw new GameValidationError([{ path: 'kind', message: 'expected a matrix game ("normal" or "sequential2")' }]);
  }
  const A = game.payoffs.map((row) => row.map((cell) => Rational.parse(cell[0]!)));
  const B = game.payoffs.map((row) => row.map((cell) => Rational.parse(cell[1]!)));
  const bm: Bimatrix = { m: A.length, n: A[0]!.length, A, B };
  cache.set(game, bm);
  return bm;
}

/**
 * Payoffs of `player` oriented as U[own action][opponent action]
 * (A for player 0, transpose of B for player 1). Lets one code path serve both players.
 */
export function ownMatrix(bm: Bimatrix, player: 0 | 1): Rational[][] {
  if (player === 0) return bm.A;
  const out: Rational[][] = [];
  for (let j = 0; j < bm.n; j++) {
    const row: Rational[] = [];
    for (let i = 0; i < bm.m; i++) row.push(bm.B[i]![j]!);
    out.push(row);
  }
  return out;
}

export function actionCount(bm: Bimatrix, player: 0 | 1): number {
  return player === 0 ? bm.m : bm.n;
}

export function assertPlayer(player: number): asserts player is 0 | 1 {
  if (player !== 0 && player !== 1) throw new RangeError(`player must be 0 or 1 (got ${player})`);
}

export function assertAction(bm: Bimatrix, player: 0 | 1, action: number): void {
  const k = actionCount(bm, player);
  if (!Number.isInteger(action) || action < 0 || action >= k) {
    throw new RangeError(`action ${action} out of range for player ${player} (0..${k - 1})`);
  }
}

export function profilePayoffs(bm: Bimatrix, [i, j]: Profile): [Rational, Rational] {
  return [bm.A[i]![j]!, bm.B[i]![j]!];
}

/** Parse and check a probability vector: non-negative, exact sum 1, correct length. */
export function toDistribution(xs: readonly RationalLike[], length: number, what = 'distribution'): Rational[] {
  if (xs.length !== length) throw new RangeError(`${what}: expected ${length} probabilities, got ${xs.length}`);
  const out = xs.map((x) => Rational.from(x));
  let total = Rational.ZERO;
  for (const p of out) {
    if (p.lt(0)) throw new RangeError(`${what}: probabilities must be non-negative`);
    total = total.add(p);
  }
  if (!total.eq(1)) throw new RangeError(`${what}: probabilities must sum to exactly 1 (got ${total})`);
  return out;
}

/** Build a NormalGame from plain numeric/rational matrices (test and content helper). */
export function makeNormalGame(
  A: readonly (readonly RationalLike[])[],
  B: readonly (readonly RationalLike[])[],
  opts: {
    rowActions?: string[];
    colActions?: string[];
    players?: [string, string];
    payoffScale?: 'ordinal' | 'cardinal';
    id?: string;
    title?: string;
  } = {},
): NormalGame {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  const rowActions = opts.rowActions ?? Array.from({ length: m }, (_, i) => `r${i}`);
  const colActions = opts.colActions ?? Array.from({ length: n }, (_, j) => `c${j}`);
  const [p0, p1] = opts.players ?? ['row', 'col'];
  const mkPlayer = (id: string, acts: string[]): Player => ({
    id,
    label: id,
    actions: acts.map((a) => ({ id: a, label: a })),
  });
  const game: NormalGame = {
    kind: 'normal',
    schemaVersion: 1,
    players: [mkPlayer(p0, rowActions), mkPlayer(p1, colActions)],
    payoffs: A.map((row, i) => row.map((a, j) => [Rational.from(a).toString(), Rational.from(B[i]![j]!).toString()])),
    payoffScale: opts.payoffScale ?? 'cardinal',
  };
  if (opts.id !== undefined) game.id = opts.id;
  if (opts.title !== undefined) game.title = opts.title;
  return game;
}
