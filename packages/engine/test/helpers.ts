import fc from 'fast-check';
import { makeNormalGame, Rational, type MixedProfile, type NormalGame, type Profile } from '../src/index.js';

export const R = (x: string | number) => Rational.from(x);

export function game(A: (number | string)[][], B: (number | string)[][], opts: Parameters<typeof makeNormalGame>[2] = {}): NormalGame {
  return makeNormalGame(A, B, opts);
}

/** Order-independent key for a list of pure profiles. */
export function profileSet(ps: readonly Profile[]): string[] {
  return ps.map((p) => p.join(',')).sort();
}

export function mixedKey(mp: MixedProfile | readonly (readonly (Rational | string)[])[]): string {
  return mp.map((v) => v.map((x) => x.toString()).join(' ')).join(' | ');
}

export function mixedSet(mps: readonly (MixedProfile | readonly (readonly (Rational | string)[])[])[]): string[] {
  return mps.map(mixedKey).sort();
}

export function strs(xs: readonly Rational[]): string[] {
  return xs.map((x) => x.toString());
}

/** Payoff matrices (A, B) as integer arrays. */
export interface IntGame {
  A: number[][];
  B: number[][];
}

export function intGameArb(m: number, n: number, lo = -5, hi = 5): fc.Arbitrary<IntGame> {
  const mat = fc.array(fc.array(fc.integer({ min: lo, max: hi }), { minLength: n, maxLength: n }), { minLength: m, maxLength: m });
  return fc.record({ A: mat, B: mat });
}

export const sizeArb = fc.constantFrom<[number, number]>([2, 2], [2, 3], [3, 2], [3, 3]);

export const anyIntGameArb: fc.Arbitrary<IntGame> = sizeArb.chain(([m, n]) => intGameArb(m, n));

export function toGame(g: IntGame, scale: 'ordinal' | 'cardinal' = 'cardinal'): NormalGame {
  return makeNormalGame(g.A, g.B, { payoffScale: scale });
}

/** Small positive rational a and arbitrary rational b, for positive affine maps a*u + b. */
export const affineArb = fc.record({
  an: fc.integer({ min: 1, max: 7 }),
  ad: fc.integer({ min: 1, max: 5 }),
  bn: fc.integer({ min: -9, max: 9 }),
  bd: fc.integer({ min: 1, max: 4 }),
});

export function mapMatrix(M: readonly (readonly (number | string | Rational)[])[], f: (x: Rational, i: number, j: number) => Rational): string[][] {
  return M.map((row, i) => row.map((x, j) => f(Rational.from(x), i, j).toString()));
}

export function transpose<T>(M: readonly (readonly T[])[]): T[][] {
  return M[0]!.map((_, j) => M.map((row) => row[j]!));
}

export const NUM_RUNS = Number(process.env.FC_RUNS ?? 1000);
