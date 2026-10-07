/** Exact expected payoffs of mixed profiles. */
import { compile, toDistribution, type MatrixGame } from './compile.js';
import { Rational, type RationalLike } from './rational.js';

/** A mixed profile: [player 0 distribution, player 1 distribution]. */
export type MixedProfile = [Rational[], Rational[]];
export type MixedProfileLike = [readonly RationalLike[], readonly RationalLike[]];

/** Expected payoff vector [u0, u1] of a mixed profile, exactly. */
export function expectedPayoffs(game: MatrixGame, profile: MixedProfileLike): [Rational, Rational] {
  const bm = compile(game);
  const x = toDistribution(profile[0], bm.m, 'player 0 strategy');
  const y = toDistribution(profile[1], bm.n, 'player 1 strategy');
  let u0 = Rational.ZERO;
  let u1 = Rational.ZERO;
  for (let i = 0; i < bm.m; i++) {
    if (x[i]!.isZero()) continue;
    for (let j = 0; j < bm.n; j++) {
      if (y[j]!.isZero()) continue;
      const w = x[i]!.mul(y[j]!);
      u0 = u0.add(w.mul(bm.A[i]![j]!));
      u1 = u1.add(w.mul(bm.B[i]![j]!));
    }
  }
  return [u0, u1];
}

/** The pure strategy `action` as a degenerate distribution over `k` actions. */
export function pureAsMixed(action: number, k: number): Rational[] {
  return Array.from({ length: k }, (_, i) => (i === action ? Rational.ONE : Rational.ZERO));
}
