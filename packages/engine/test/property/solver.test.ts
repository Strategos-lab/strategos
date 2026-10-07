/** Solver correctness properties on random integer games (2x2, 2x3, 3x2, 3x3). */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  bestResponses,
  checkNash,
  dominance,
  iesds,
  iteratedWeakDominance,
  makeNormalGame,
  pureNash,
  Rational,
  solveEquilibria,
  supportBestResponses,
  supportEnumeration,
} from '../../src/index.js';
import { anyIntGameArb, intGameArb, NUM_RUNS, toGame } from '../helpers.js';

const params = { numRuns: NUM_RUNS };

describe('equilibrium solver properties', () => {
  it('ALWAYS returns at least one equilibrium and certifies completeness (never an empty set)', () => {
    fc.assert(
      fc.property(anyIntGameArb, (g) => {
        const eq = solveEquilibria(toGame(g));
        expect(eq.complete).toBe(true);
        expect(eq.extremeEquilibria.length).toBeGreaterThan(0);
        expect(eq.pure.length + eq.mixed.length + eq.continua.length).toBeGreaterThan(0);
        expect(eq.finite).toBe(eq.continua.length === 0);
      }),
      { numRuns: NUM_RUNS * 3 },
    );
  });

  it('pure NE are exactly the mutual-best-response cells (brute force)', () => {
    fc.assert(
      fc.property(anyIntGameArb, (g) => {
        const G = toGame(g);
        const brute: string[] = [];
        for (let i = 0; i < g.A.length; i++)
          for (let j = 0; j < g.A[0]!.length; j++)
            if (bestResponses(G, 0, j).includes(i) && bestResponses(G, 1, i).includes(j)) brute.push(`${i},${j}`);
        expect(pureNash(G).map((p) => p.join(','))).toEqual(brute);
        expect(solveEquilibria(G).pure.map((p) => p.join(','))).toEqual(brute);
      }),
      params,
    );
  });

  it('every reported equilibrium (mixed, extreme, continuum vertices and interior points) has no profitable deviation, exactly', () => {
    fc.assert(
      fc.property(anyIntGameArb, fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 12, maxLength: 12 }), (g, w) => {
        const G = toGame(g);
        const eq = solveEquilibria(G);
        for (const mp of [...eq.mixed, ...eq.extremeEquilibria]) {
          const c = checkNash(G, mp);
          expect(c.isNash).toBe(true);
          expect(c.deviationGains.every((x) => x.isZero())).toBe(true);
          // Indifference: every action in the support is a best response.
          const [br0, br1] = supportBestResponses(G, mp);
          mp[0].forEach((p, i) => p.isZero() || expect(br0).toContain(i));
          mp[1].forEach((p, j) => p.isZero() || expect(br1).toContain(j));
        }
        for (const c of eq.continua) {
          const mix = (vs: Rational[][], off: number) => {
            const ws = vs.map((_, k) => Rational.of(w[(off + k) % w.length]! + 1));
            const tot = ws.reduce((a, b) => a.add(b), Rational.ZERO);
            return vs[0]!.map((_, t) => vs.reduce((acc, v, k) => acc.add(v[t]!.mul(ws[k]!)), Rational.ZERO).div(tot));
          };
          expect(checkNash(G, [mix(c.vertices[0], 0), mix(c.vertices[1], 5)]).isNash).toBe(true);
          for (const x of c.vertices[0]) for (const y of c.vertices[1]) expect(checkNash(G, [x, y]).isNash).toBe(true);
        }
      }),
      params,
    );
  });

  it('2x2: the reported set is exactly the set of equilibria on a fine rational grid (soundness and completeness)', () => {
    const K = 12;
    const grid = Array.from({ length: K + 1 }, (_, k) => Rational.of(k, K));
    fc.assert(
      fc.property(intGameArb(2, 2, -3, 3), (g) => {
        const G = toGame(g);
        const eq = solveEquilibria(G);
        const inSet = (p: Rational, q: Rational) => {
          const eqv = (a: Rational[], b: Rational) => a[0]!.eq(b);
          if (eq.extremeEquilibria.some((m) => eqv(m[0], p) && eqv(m[1], q))) return true;
          return eq.continua.some((c) => {
            const xs = c.vertices[0].map((v) => v[0]!);
            const ys = c.vertices[1].map((v) => v[0]!);
            const between = (vals: Rational[], t: Rational) => vals.some((a) => a.le(t)) && vals.some((a) => a.ge(t));
            return between(xs, p) && between(ys, q);
          });
        };
        for (const p of grid)
          for (const q of grid) {
            const isNE = checkNash(G, [[p, Rational.ONE.sub(p)], [q, Rational.ONE.sub(q)]]).isNash;
            expect(inSet(p, q)).toBe(isNE);
          }
      }),
      params,
    );
  });

  it('nondegenerate games: independent support enumeration finds exactly the same equilibria, and there are no continua', () => {
    fc.assert(
      fc.property(anyIntGameArb, (g) => {
        const G = toGame(g);
        const eq = solveEquilibria(G);
        const se = supportEnumeration(G);
        expect(se.degenerate).toBe(eq.degenerate);
        if (!eq.degenerate) {
          const key = (m: Rational[][]) => m.map((v) => v.join(' ')).join('|');
          expect(se.equilibria.map(key).sort()).toEqual(eq.extremeEquilibria.map(key).sort());
          expect(eq.continua).toEqual([]);
          expect(eq.extremeEquilibria.length % 2).toBe(1); // odd number of equilibria in nondegenerate games
        }
      }),
      params,
    );
  });

  it('a strictly dominated action is never played with positive probability in any equilibrium; every pure NE survives IESDS', () => {
    fc.assert(
      fc.property(anyIntGameArb, (g) => {
        const G = toGame(g);
        const eq = solveEquilibria(G);
        for (const p of [0, 1] as const) {
          const dominated = dominance(G, p).actions.filter((a) => a.strictlyDominatedBy.length > 0).map((a) => a.action);
          for (const m of eq.extremeEquilibria) for (const a of dominated) expect(m[p][a]!.isZero()).toBe(true);
        }
        const surv = iesds(G).surviving;
        for (const [i, j] of eq.pure) {
          expect(surv[0]).toContain(i);
          expect(surv[1]).toContain(j);
        }
      }),
      params,
    );
  });

  it('a strictly dominant strategy profile is the unique Nash equilibrium', () => {
    fc.assert(
      fc.property(
        anyIntGameArb,
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 2 }),
        (g, di, dj) => {
          const m = g.A.length;
          const n = g.A[0]!.length;
          const i0 = di % m;
          const j0 = dj % n;
          // Make row i0 and column j0 strictly dominant by adding a bonus larger than the payoff range.
          const A = g.A.map((row, i) => row.map((x) => (i === i0 ? x + 11 : x)));
          const B = g.B.map((row) => row.map((x, j) => (j === j0 ? x + 11 : x)));
          const G = makeNormalGame(A, B);
          expect(dominance(G, 0).strictlyDominantAction).toBe(i0);
          expect(dominance(G, 1).strictlyDominantAction).toBe(j0);
          const eq = solveEquilibria(G);
          expect(eq.pure).toEqual([[i0, j0]]);
          expect(eq.mixed).toEqual([]);
          expect(eq.continua).toEqual([]);
          expect(eq.extremeEquilibria).toHaveLength(1);
        },
      ),
      params,
    );
  });

  it('IESDS is order independent (random elimination orders reach the same survivors); weak elimination reports every order\'s result', () => {
    fc.assert(
      fc.property(anyIntGameArb, fc.array(fc.nat(), { minLength: 20, maxLength: 20 }), (g, picks) => {
        const G = toGame(g);
        // Random-order strict elimination, one action at a time.
        let alive: [number[], number[]] = [g.A.map((_, i) => i), g.A[0]!.map((_, j) => j)];
        const U = [g.A, g.A[0]!.map((_, j) => g.B.map((row) => row[j]!))];
        for (let t = 0; ; t++) {
          const cands: [0 | 1, number][] = [];
          for (const p of [0, 1] as const)
            for (const a of alive[p])
              if (alive[p].some((b) => b !== a && alive[1 - p]!.every((s) => U[p]![b]![s]! > U[p]![a]![s]!))) cands.push([p, a]);
          if (cands.length === 0) break;
          const [p, a] = cands[picks[t % picks.length]! % cands.length]!;
          alive = p === 0 ? [alive[0].filter((x) => x !== a), alive[1]] : [alive[0], alive[1].filter((x) => x !== a)];
        }
        expect(iesds(G).surviving).toEqual(alive);
        const w = iteratedWeakDominance(G);
        expect(w.possibleResults.map((r) => JSON.stringify(r))).toContain(JSON.stringify(w.surviving));
        expect(w.orderDependent).toBe(w.possibleResults.length > 1);
      }),
      params,
    );
  });
});
