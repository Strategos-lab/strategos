/**
 * Bug (2026-10-07, found by a fast-check property): iterated weak dominance explored only
 * one-at-a-time elimination orders. In this game removing row 0 and column 1 TOGETHER gives
 * {row 1} x {col 0}, but removing either one first makes the other no longer weakly dominated
 * (its only strict advantage was against the removed action). The simultaneous result was
 * therefore missing from `possibleResults`.
 */
import { describe, expect, it } from 'vitest';
import { iteratedWeakDominance, makeNormalGame } from '../../src/index.js';

describe('regression: IWDS order search includes simultaneous removals', () => {
  it('counterexample from fast-check', () => {
    const g = makeNormalGame([[-4, 0], [-4, 1]], [[0, -1], [5, 5]]);
    const w = iteratedWeakDominance(g);
    expect(w.surviving).toEqual([[1], [0]]);
    expect(w.possibleResults.map((r) => JSON.stringify(r)).sort()).toEqual(
      ['[[0,1],[0]]', '[[1],[0,1]]', '[[1],[0]]'].sort(),
    );
    expect(w.orderDependent).toBe(true);
  });
});
