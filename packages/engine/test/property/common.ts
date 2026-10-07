import fc from 'fast-check';
import {
  bestResponseTable,
  dominance,
  iesds,
  Rational,
  solveEquilibria,
  type EquilibriumSet,
  type NormalGame,
} from '../../src/index.js';

/** Canonical, order-independent fingerprint of an equilibrium set. */
export function eqFingerprint(eq: EquilibriumSet): string {
  const vec = (v: Rational[]) => v.map(String).join(' ');
  const pure = eq.pure.map((p) => p.join(',')).sort();
  const mixed = eq.mixed.map((m) => `${vec(m[0])}|${vec(m[1])}`).sort();
  const cont = eq.continua
    .map((c) => `${c.vertices[0].map(vec).sort().join(';')}x${c.vertices[1].map(vec).sort().join(';')}`)
    .sort();
  const ext = eq.extremeEquilibria.map((m) => `${vec(m[0])}|${vec(m[1])}`).sort();
  return JSON.stringify({ pure, mixed, cont, ext, degenerate: eq.degenerate });
}

export function brFingerprint(g: NormalGame): string {
  return JSON.stringify([0, 1].map((p) => bestResponseTable(g, p).map((r) => r.best)));
}

export function domFingerprint(g: NormalGame): string {
  return JSON.stringify(
    [0, 1].map((p) =>
      dominance(g, p).actions.map((a) => [a.strictlyDominant, a.weaklyDominant, a.alwaysBestResponse, a.strictlyDominatedBy, a.weaklyDominatedBy]),
    ),
  );
}

export function allFingerprints(g: NormalGame) {
  return { br: brFingerprint(g), dom: domFingerprint(g), eq: eqFingerprint(solveEquilibria(g)), iesds: JSON.stringify(iesds(g).surviving) };
}

/** Random probability vector of length k with exact rational entries. */
export function distArb(k: number): fc.Arbitrary<Rational[]> {
  return fc
    .array(fc.integer({ min: 0, max: 12 }), { minLength: k, maxLength: k })
    .filter((w) => w.some((x) => x > 0))
    .map((w) => {
      const s = w.reduce((a, b) => a + b, 0);
      return w.map((x) => Rational.of(x, s));
    });
}

export function permArb(k: number): fc.Arbitrary<number[]> {
  return fc.shuffledSubarray(
    Array.from({ length: k }, (_, i) => i),
    { minLength: k, maxLength: k },
  );
}

/** Random PD with independent (ordinally consistent) payoffs per player: T > R > P > S. */
const pdValues = fc
  .tuple(fc.integer({ min: -5, max: 5 }), fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 }))
  .map(([S, a, b, c]) => ({ S, P: S + a, R: S + a + b, T: S + a + b + c }));

export const pdGameArb = fc.tuple(pdValues, pdValues, fc.boolean(), fc.boolean()).map(([u, v, swapRow, swapCol]) => {
  // Action 0 = C unless swapped.
  let A = [[u.R, u.S], [u.T, u.P]];
  let B = [[v.R, v.T], [v.S, v.P]];
  if (swapRow) {
    A = [A[1]!, A[0]!];
    B = [B[1]!, B[0]!];
  }
  if (swapCol) {
    A = A.map((r) => [r[1]!, r[0]!]);
    B = B.map((r) => [r[1]!, r[0]!]);
  }
  return { A, B };
});

