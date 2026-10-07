/** Classifier properties. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classifyFamily, makeNormalGame, paretoAnalysis, Rational, solveEquilibria } from '../../src/index.js';
import { affineArb, intGameArb, mapMatrix, NUM_RUNS, toGame, transpose } from '../helpers.js';
import { pdGameArb } from './common.js';

const params = { numRuns: NUM_RUNS };

describe('classifier properties', () => {
  it('PD classification implies a unique NE that is Pareto-dominated', () => {
    fc.assert(
      fc.property(pdGameArb, (g) => {
        const G = toGame(g);
        expect(classifyFamily(G).family).toBe('prisoners_dilemma');
        const eq = solveEquilibria(G);
        expect(eq.extremeEquilibria).toHaveLength(1);
        expect(eq.pure).toHaveLength(1);
        expect(eq.mixed).toHaveLength(0);
        expect(eq.continua).toHaveLength(0);
        expect(paretoAnalysis(G, eq).everyEquilibriumParetoDominated).toBe(true);
      }),
      params,
    );
  });

  it('and conversely on random games: whenever the classifier says PD, the unique-NE-Pareto-dominated signature holds', () => {
    fc.assert(
      fc.property(intGameArb(2, 2), (g) => {
        const G = toGame(g);
        if (classifyFamily(G).family !== 'prisoners_dilemma') return;
        const eq = solveEquilibria(G);
        expect(eq.extremeEquilibria).toHaveLength(1);
        expect(paretoAnalysis(G, eq).everyEquilibriumParetoDominated).toBe(true);
      }),
      { numRuns: NUM_RUNS * 3 },
    );
  });

  it('family is invariant under relabelling actions, swapping players, and positive affine maps of each player', () => {
    fc.assert(
      fc.property(intGameArb(2, 2), fc.boolean(), fc.boolean(), affineArb, affineArb, (g, sr, sc, f0, f1) => {
        const fam = classifyFamily(toGame(g)).family;
        let A = g.A;
        let B = g.B;
        if (sr) {
          A = [A[1]!, A[0]!];
          B = [B[1]!, B[0]!];
        }
        if (sc) {
          A = A.map((r) => [r[1]!, r[0]!]);
          B = B.map((r) => [r[1]!, r[0]!]);
        }
        expect(classifyFamily(makeNormalGame(A, B)).family).toBe(fam);
        expect(classifyFamily(makeNormalGame(transpose(g.B), transpose(g.A))).family).toBe(fam);
        const aff = (f: typeof f0) => (x: Rational) => Rational.of(f.an, f.ad).mul(x).add(Rational.of(f.bn, f.bd));
        const fam2 = classifyFamily(makeNormalGame(mapMatrix(g.A, aff(f0)), mapMatrix(g.B, aff(f1)))).family;
        // Constant-sum is a cardinal property: affine maps with different scales can break it (matching pennies family).
        if (fam !== 'matching_pennies' && fam2 !== 'matching_pennies') expect(fam2).toBe(fam);
      }),
      params,
    );
  });

  it('at most one family rule ever matches', () => {
    fc.assert(
      fc.property(intGameArb(2, 2, -3, 3), (g) => {
        expect(classifyFamily(toGame(g)).matches.length).toBeLessThanOrEqual(1);
      }),
      { numRuns: NUM_RUNS * 3 },
    );
  });
});
