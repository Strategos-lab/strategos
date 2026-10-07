import { describe, expect, it } from 'vitest';
import { paretoAnalysis, solveEquilibria } from '../../src/index.js';
import { game, profileSet } from '../helpers.js';

describe('Pareto analysis', () => {
  it('PD: (D,D) is dominated by (C,C); every NE dominated (social dilemma)', () => {
    const p = paretoAnalysis(game([[3, 0], [5, 1]], [[3, 5], [0, 1]]));
    expect(profileSet(p.dominated)).toEqual(['1,1']);
    expect(p.outcomes.find((o) => o.profile.join() === '1,1')!.dominatedBy).toEqual([[0, 0]]);
    expect(p.pureEquilibria).toEqual([{ profile: [1, 1], paretoDominated: true, dominatedBy: [[0, 0]] }]);
    expect(p.everyEquilibriumParetoDominated).toBe(true);
  });

  it('equal outcomes do not dominate each other', () => {
    const p = paretoAnalysis(game([[1, 1], [1, 1]], [[1, 1], [1, 1]]));
    expect(p.efficient).toHaveLength(4);
  });

  it('mixed NE payoffs are checked against pure outcomes (BoS mixed NE is dominated, pure ones are not)', () => {
    const g = game([[2, 0], [0, 1]], [[1, 0], [0, 2]]);
    const p = paretoAnalysis(g);
    expect(p.mixedEquilibria).toHaveLength(1);
    expect(p.mixedEquilibria[0]!.paretoDominated).toBe(true);
    expect(p.everyEquilibriumParetoDominated).toBe(false);
  });

  it('a game whose only NE is mixed and Pareto-dominated (social-dilemma signature without pure NE)', () => {
    // Cyclic best responses; hand computation: column mixes 1/5 on c0, row mixes 1/2; payoffs (4/5, 3); cell (r0,c0) = (4,4) dominates.
    const g = game([[4, 0], [0, 1]], [[4, 5], [2, 1]]);
    const eq = solveEquilibria(g);
    expect(eq.pure).toHaveLength(0);
    expect(eq.mixed.map((m) => m.map((v) => v.map(String)))).toEqual([[['1/2', '1/2'], ['1/5', '4/5']]]);
    const p = paretoAnalysis(g, eq);
    expect(p.mixedEquilibria[0]!.payoffs.map(String)).toEqual(['4/5', '3']);
    expect(p.mixedEquilibria[0]!.dominatedBy).toEqual([[0, 0]]);
    expect(p.everyEquilibriumParetoDominated).toBe(true);
    // Matching pennies: mixed NE (0,0) is not dominated by any cell.
    expect(paretoAnalysis(game([[1, -1], [-1, 1]], [[-1, 1], [1, -1]])).everyEquilibriumParetoDominated).toBe(false);
  });

  it('continua: all points dominated iff the best corner is dominated', () => {
    // Row indifferent everywhere, column indifferent everywhere -> whole space; cell (0,0) = (3,3) dominates corner (1,1)? no: payoffs constant 1 except... use explicit:
    const g = game([[1, 1], [1, 1]], [[1, 1], [1, 1]]);
    const p = paretoAnalysis(g);
    expect(p.continua).toHaveLength(1);
    expect(p.continua[0]!.allParetoDominated).toBe(false);
    expect(p.everyEquilibriumParetoDominated).toBe(false);
    // Entry-style simultaneous game: continuum {stay away} x [0,1/3] pays (0, 3): not dominated (3 is column max).
    const e = paretoAnalysis(game([[2, -1], [0, 0]], [[1, -1], [3, 3]]));
    expect(e.continua[0]!.allParetoDominated).toBe(false);
  });

  it('continuum corner uses each player\'s maximum payoff over the continuum', () => {
    // Column: c1 strictly dominant. Row indifferent against c1 -> NE continuum {any x} x {c1}.
    // Row's payoff is 1 throughout; column's ranges over [1, 4]; corner (1, 4) = cell (r0, c1) is efficient.
    const g = game([[3, 1], [4, 1]], [[3, 4], [0, 1]]);
    const eq = solveEquilibria(g);
    expect(eq.continua).toHaveLength(1);
    const p = paretoAnalysis(g, eq);
    expect(p.continua[0]!.bestCorner.map(String)).toEqual(['1', '4']);
    expect(p.continua[0]!.allParetoDominated).toBe(false);
    expect(p.everyEquilibriumParetoDominated).toBe(false);
  });

  it('incomplete equilibrium set -> null rather than a claim', () => {
    const A = Array.from({ length: 7 }, (_, i) => [i % 2, (i + 1) % 2]);
    const p = paretoAnalysis(game(A, A));
    expect(p.everyEquilibriumParetoDominated).toBeNull();
  });
});
