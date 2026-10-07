/** Invariance properties: affine maps, opponent-dependent constants, monotone maps, relabelling, player swap. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bestResponses, classifyFamily, dominance, iesds, Rational, solveEquilibria, type Profile } from '../../src/index.js';
import { affineArb, anyIntGameArb, mapMatrix, NUM_RUNS, toGame, transpose } from '../helpers.js';
import { allFingerprints, brFingerprint, domFingerprint, eqFingerprint, permArb } from './common.js';
import { makeNormalGame } from '../../src/index.js';

const params = { numRuns: NUM_RUNS };

describe('invariance properties', () => {
  it('positive affine transformation (a*u + b, a > 0 rational) of ONE player leaves BR, dominance, pure NE and mixed NE unchanged', () => {
    fc.assert(
      fc.property(anyIntGameArb, affineArb, fc.constantFrom(0, 1), (g, { an, ad, bn, bd }, who) => {
        const a = Rational.of(an, ad);
        const b = Rational.of(bn, bd);
        const A = who === 0 ? mapMatrix(g.A, (x) => a.mul(x).add(b)) : g.A;
        const B = who === 1 ? mapMatrix(g.B, (x) => a.mul(x).add(b)) : g.B;
        const before = allFingerprints(toGame(g));
        const after = allFingerprints(makeNormalGame(A, B));
        expect(after).toEqual(before);
      }),
      params,
    );
  });

  it('adding to a player\'s payoffs a constant that depends only on the opponent\'s action leaves that player\'s BR (and dominance, and the NE set) unchanged', () => {
    fc.assert(
      fc.property(anyIntGameArb, fc.array(fc.integer({ min: -20, max: 20 }), { minLength: 3, maxLength: 3 }), fc.constantFrom(0, 1), (g, c, who) => {
        // Row player: add c[j] to A[i][j] for every i. Column player: add c[i] to B[i][j] for every j.
        const A = who === 0 ? mapMatrix(g.A, (x, _i, j) => x.add(c[j]!)) : g.A;
        const B = who === 1 ? mapMatrix(g.B, (x, i) => x.add(c[i]!)) : g.B;
        const g0 = toGame(g);
        const g1 = makeNormalGame(A, B);
        const k = who === 0 ? g.A[0]!.length : g.A.length;
        for (let s = 0; s < k; s++) expect(bestResponses(g1, who, s)).toEqual(bestResponses(g0, who, s));
        expect(domFingerprint(g1)).toEqual(domFingerprint(g0));
        expect(eqFingerprint(solveEquilibria(g1))).toEqual(eqFingerprint(solveEquilibria(g0)));
      }),
      params,
    );
  });

  it('a strictly increasing (monotone) transformation preserves dominance and pure NE', () => {
    fc.assert(
      fc.property(anyIntGameArb, fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 11, maxLength: 11 }), fc.constantFrom(0, 1), (g, gaps, who) => {
        // Monotone map on [-5, 5]: f(v) = sum of the first (v + 5) random positive gaps.
        const f = (x: Rational) => {
          const v = Number(x.n) + 5;
          return Rational.of(gaps.slice(0, v + 1).reduce((s, t) => s + t, 0));
        };
        const A = who === 0 ? mapMatrix(g.A, f) : g.A;
        const B = who === 1 ? mapMatrix(g.B, f) : g.B;
        const g0 = toGame(g);
        const g1 = makeNormalGame(A, B);
        expect(domFingerprint(g1)).toEqual(domFingerprint(g0));
        expect(brFingerprint(g1)).toEqual(brFingerprint(g0));
        expect(solveEquilibria(g1).pure).toEqual(solveEquilibria(g0).pure);
      }),
      params,
    );
  });

  it('a monotone transformation CAN change mixed NE (the engine does not pretend otherwise)', () => {
    const bos = makeNormalGame([[2, 0], [0, 1]], [[1, 0], [0, 2]]);
    const cubed = makeNormalGame([[8, 0], [0, 1]], [[1, 0], [0, 2]]); // f(x) = x^3 on the row player's payoffs
    const m0 = solveEquilibria(bos).mixed[0]!;
    const m1 = solveEquilibria(cubed).mixed[0]!;
    expect(m0[1].map(String)).toEqual(['1/3', '2/3']);
    expect(m1[1].map(String)).toEqual(['1/9', '8/9']);
    expect(solveEquilibria(cubed).pure).toEqual(solveEquilibria(bos).pure);
  });

  it('relabelling (permuting) actions permutes every result', () => {
    fc.assert(
      fc.property(
        anyIntGameArb.chain((g) => fc.tuple(fc.constant(g), permArb(g.A.length), permArb(g.A[0]!.length))),
        ([g, pr, pc]) => {
          // New row i is old row pr[i]; new column j is old column pc[j].
          const A = pr.map((i) => pc.map((j) => g.A[i]![j]!));
          const B = pr.map((i) => pc.map((j) => g.B[i]![j]!));
          const g0 = toGame(g);
          const g1 = makeNormalGame(A, B);
          const invR = pr.map((_, k) => pr.indexOf(k));
          const invC = pc.map((_, k) => pc.indexOf(k));
          const mapP = ([i, j]: Profile) => `${invR[i]},${invC[j]}`;
          const e0 = solveEquilibria(g0);
          const e1 = solveEquilibria(g1);
          expect(e1.pure.map((p) => p.join(',')).sort()).toEqual(e0.pure.map(mapP).sort());
          const permVec = (v: Rational[], perm: number[]) => perm.map((k) => v[k]!.toString()).join(' ');
          const mixedKeys = (eq: typeof e0, rp: number[] | null, cp: number[] | null) =>
            eq.extremeEquilibria.map((m) => `${rp ? permVec(m[0], rp) : m[0].join(' ')}|${cp ? permVec(m[1], cp) : m[1].join(' ')}`).sort();
          expect(mixedKeys(e1, null, null)).toEqual(mixedKeys(e0, pr, pc));
          expect(e1.continua.length).toBe(e0.continua.length);
          expect(e1.degenerate).toBe(e0.degenerate);
          // Dominance: strictly dominated-by sets map through the permutation.
          for (const [p, inv] of [[0, invR], [1, invC]] as const) {
            const d0 = dominance(g0, p).actions;
            const d1 = dominance(g1, p).actions;
            d0.forEach((a) => {
              const b = d1[inv[a.action]!]!;
              expect(b.strictlyDominatedBy.map((x) => x).sort()).toEqual(a.strictlyDominatedBy.map((x) => inv[x]!).sort());
              expect(b.strictlyDominant).toBe(a.strictlyDominant);
            });
          }
          const s0 = iesds(g0).surviving;
          const s1 = iesds(g1).surviving;
          expect(s1[0]).toEqual(s0[0].map((i) => invR[i]!).sort());
          expect(s1[1]).toEqual(s0[1].map((j) => invC[j]!).sort());
          if (g.A.length === 2 && g.A[0]!.length === 2) expect(classifyFamily(g1).family).toBe(classifyFamily(g0).family);
        },
      ),
      params,
    );
  });

  it('swapping players transposes every result', () => {
    fc.assert(
      fc.property(anyIntGameArb, (g) => {
        const g0 = toGame(g);
        const g1 = makeNormalGame(transpose(g.B), transpose(g.A));
        const e0 = solveEquilibria(g0);
        const e1 = solveEquilibria(g1);
        expect(e1.pure.map(([i, j]) => `${j},${i}`).sort()).toEqual(e0.pure.map((p) => p.join(',')).sort());
        const key = (m: Rational[][]) => m.map((v) => v.join(' ')).join('|');
        expect(e1.extremeEquilibria.map((m) => key([m[1], m[0]])).sort()).toEqual(e0.extremeEquilibria.map(key).sort());
        expect(e1.mixed.length).toBe(e0.mixed.length);
        expect(e1.continua.length).toBe(e0.continua.length);
        expect(JSON.stringify(dominance(g1, 0).actions)).toBe(JSON.stringify(dominance(g0, 1).actions));
        expect(JSON.stringify(dominance(g1, 1).actions)).toBe(JSON.stringify(dominance(g0, 0).actions));
        if (g.A.length === 2 && g.A[0]!.length === 2) expect(classifyFamily(g1).family).toBe(classifyFamily(g0).family);
      }),
      params,
    );
  });
});
