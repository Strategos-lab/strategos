import { describe, expect, it } from 'vitest';
import { classifyFamily } from '../../src/index.js';
import { game, transpose } from '../helpers.js';

/** Symmetric 2x2 from row-player values R, S, T, P (action 0 = C). */
const sym = (R: number, S: number, T: number, P: number) => game([[R, S], [T, P]], [[R, T], [S, P]]);

describe('family classifier (2x2, ordinal rules)', () => {
  it('Prisoner\'s Dilemma, with the 2R > T + S repeated-game condition', () => {
    const c = classifyFamily(sym(3, 0, 5, 1));
    expect(c.family).toBe('prisoners_dilemma');
    expect(c.pdRepeatedCondition).toEqual({ holds: true, perPlayer: [true, true] });
    expect(c.symmetric).toBe(true);
    expect(c.roles).toEqual({ cooperate: [0, 0], defect: [1, 1] });
    expect(c.reasons).toContain('player 0: T (5) > R (3)');
    const weak = classifyFamily(sym(3, 0, 7, 1));
    expect(weak.family).toBe('prisoners_dilemma');
    expect(weak.pdRepeatedCondition!.holds).toBe(false);
  });

  it('PD is detected under relabelling of either player\'s actions and under player swap', () => {
    // Swap row actions only: row 0 = D.
    const g1 = game([[5, 1], [3, 0]], [[0, 1], [3, 5]]);
    const c1 = classifyFamily(g1);
    expect(c1.family).toBe('prisoners_dilemma');
    expect(c1.roles).toEqual({ cooperate: [1, 0], defect: [0, 1] });
    expect(c1.symmetric).toBe(true);
    // Player swap = transpose and exchange matrices.
    const A = [[3, 0], [5, 1]];
    const B = [[3, 5], [0, 1]];
    expect(classifyFamily(game(transpose(B), transpose(A))).family).toBe('prisoners_dilemma');
  });

  it('ordinally (not cardinally) symmetric PD still classifies; symmetric=false', () => {
    const c = classifyFamily(game([[3, 0], [5, 1]], [[30, 50], [0, 10]]));
    expect(c.family).toBe('prisoners_dilemma');
    expect(c.symmetric).toBe(false);
  });

  it('a tie breaks a strict rule: T = R is not a PD', () => {
    const c = classifyFamily(sym(3, 0, 3, 1));
    expect(c.family).toBe('other');
    expect(c.ties.length).toBeGreaterThan(0);
    expect(c.reasons.join(' ')).toMatch(/ties present/);
  });

  it('Stag Hunt, strict and with the explicitly allowed tie T = P', () => {
    expect(classifyFamily(sym(4, 0, 3, 2)).family).toBe('stag_hunt');
    const tie = classifyFamily(sym(4, 0, 3, 3));
    expect(tie.family).toBe('stag_hunt');
    expect(tie.reasons).toContain('player 0: T (3) = P (3)');
    // R = T is not a stag hunt
    expect(classifyFamily(sym(3, 0, 3, 2)).family).toBe('other');
  });

  it('Chicken, Harmony (both orderings), Deadlock', () => {
    expect(classifyFamily(sym(3, 1, 4, 0)).family).toBe('chicken');
    expect(classifyFamily(sym(4, 2, 3, 1)).family).toBe('harmony');
    expect(classifyFamily(sym(4, 3, 2, 1)).family).toBe('harmony');
    expect(classifyFamily(sym(2, 1, 4, 3)).family).toBe('deadlock');
  });

  it('Battle of the Sexes (asymmetric coordination, ties among miscoordination payoffs allowed)', () => {
    const c = classifyFamily(game([[2, 0], [0, 1]], [[1, 0], [0, 2]]));
    expect(c.family).toBe('battle_of_the_sexes');
    expect(c.symmetric).toBe(true); // symmetric after relabelling player 1's actions
    // The "leader" ordering T > S > R > P is BoS-like as well.
    expect(classifyFamily(sym(1, 3, 4, 0)).family).toBe('battle_of_the_sexes');
  });

  it('pure coordination: equal and Pareto-ranked subtypes', () => {
    const eq = classifyFamily(game([[1, 0], [0, 1]], [[1, 0], [0, 1]]));
    expect(eq.family).toBe('pure_coordination');
    expect(eq.subtype).toBe('equal-equilibria');
    const ranked = classifyFamily(game([[2, 0], [0, 1]], [[2, 0], [0, 1]]));
    expect(ranked.family).toBe('pure_coordination');
    expect(ranked.subtype).toBe('ranked-equilibria');
  });

  it('Matching Pennies family: constant-sum without pure NE; constant-sum with pure NE is not', () => {
    expect(classifyFamily(game([[1, -1], [-1, 1]], [[-1, 1], [1, -1]])).family).toBe('matching_pennies');
    expect(classifyFamily(game([[3, 1], [1, 3]], [[1, 3], [3, 1]])).family).toBe('matching_pennies'); // constant-sum 4
    expect(classifyFamily(game([[1, 2], [0, 1]], [[-1, -2], [0, -1]])).family).toBe('other');
  });

  it('a cyclic game with no pure NE that is not constant-sum is "other"', () => {
    expect(classifyFamily(game([[1, 0], [0, 1]], [[0, 2], [1, 0]])).family).toBe('other');
  });

  it('not applicable beyond 2x2', () => {
    const c = classifyFamily(game([[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 3]]));
    expect(c).toMatchObject({ family: 'other', applicable: false });
  });

  it('families are mutually exclusive over all strict ordinal 2x2 games (24 x 24 orderings)', () => {
    const perms: number[][] = [];
    const permute = (xs: number[], acc: number[]) => {
      if (xs.length === 0) perms.push(acc);
      xs.forEach((x, i) => permute([...xs.slice(0, i), ...xs.slice(i + 1)], [...acc, x]));
    };
    permute([1, 2, 3, 4], []);
    const counts: Record<string, number> = {};
    for (const p of perms) {
      for (const q of perms) {
        const c = classifyFamily(game([[p[0]!, p[1]!], [p[2]!, p[3]!]], [[q[0]!, q[1]!], [q[2]!, q[3]!]]));
        expect(c.matches.length).toBeLessThanOrEqual(1);
        counts[c.family] = (counts[c.family] ?? 0) + 1;
      }
    }
    // Every named family occurs among strict ordinal games.
    for (const f of ['prisoners_dilemma', 'stag_hunt', 'chicken', 'harmony', 'deadlock', 'pure_coordination', 'battle_of_the_sexes', 'matching_pennies', 'other']) {
      expect(counts[f] ?? 0).toBeGreaterThan(0);
    }
  });
});
