import { describe, expect, it } from 'vitest';
import { dominance, iesds, iteratedWeakDominance } from '../../src/index.js';
import { game } from '../helpers.js';

describe('pure-strategy dominance', () => {
  it('PD: defect strictly (and weakly) dominant; cooperate strictly dominated', () => {
    const d = dominance(game([[3, 0], [5, 1]], [[3, 5], [0, 1]]), 0);
    expect(d.against).toBe('pure-strategies');
    expect(d.strictlyDominantAction).toBe(1);
    expect(d.weaklyDominantAction).toBe(1);
    expect(d.actions[0]).toMatchObject({ strictlyDominatedBy: [1], weaklyDominatedBy: [1], strictlyDominant: false });
    expect(d.actions[1]).toMatchObject({ strictlyDominant: true, weaklyDominant: true, alwaysBestResponse: true });
  });

  it('weak but not strict dominance', () => {
    const d = dominance(game([[1, 1], [1, 0]], [[0, 0], [0, 0]]), 0);
    expect(d.strictlyDominantAction).toBeNull();
    expect(d.weaklyDominantAction).toBe(0);
    expect(d.actions[1]).toMatchObject({ strictlyDominatedBy: [], weaklyDominatedBy: [0] });
  });

  it('duplicate actions: neither weakly dominant, both always best responses', () => {
    const d = dominance(game([[2, 2], [2, 2]], [[0, 0], [0, 0]]), 0);
    expect(d.weaklyDominantAction).toBeNull();
    expect(d.actions.every((a) => a.alwaysBestResponse && a.weaklyDominatedBy.length === 0)).toBe(true);
  });

  it('column player uses its own payoffs (transpose)', () => {
    const d = dominance(game([[0, 0, 0], [0, 0, 0]], [[0, 2, 1], [3, 1, 0]]), 1);
    expect(d.actions[2]!.strictlyDominatedBy).toEqual([1]);
    expect(d.actions[0]!.strictlyDominatedBy).toEqual([]);
  });

  it('documented limit: domination by a MIXED strategy is not detected (V1 = pure only)', () => {
    // Action 2 pays (1,1); the 50/50 mix of actions 0 and 1 pays (3/2, 3/2) > (1,1), but no pure action dominates it.
    const d = dominance(game([[3, 0], [0, 3], [1, 1]], [[0, 0], [0, 0], [0, 0]]), 0);
    expect(d.actions[2]!.strictlyDominatedBy).toEqual([]);
    expect(d.against).toBe('pure-strategies');
  });

  it('single-action player is vacuously dominant', () => {
    const d = dominance(game([[1, 2]], [[0, 0]]), 0);
    expect(d.strictlyDominantAction).toBe(0);
  });
});

describe('IESDS', () => {
  it('3x3 solvable game with elimination sequence', () => {
    // Row: R2 dominated by R0 ; then column C2 dominated ; then ...
    const g = game(
      [
        [4, 3, 5],
        [2, 1, 3],
        [3, 4, 1],
      ],
      [
        [3, 1, 0],
        [4, 2, 1],
        [1, 3, 0],
      ],
    );
    const res = iesds(g);
    // Round 1: row 1 dominated by row 0 (4>2,3>1,5>3); col 2 dominated by col 0 (3>0, 4>1, 1>0) and by col 1? (1>0,2>1,3>0) yes.
    expect(res.steps.filter((s) => s.round === 1)).toEqual([
      { round: 1, player: 0, action: 1, dominatedBy: [0] },
      { round: 1, player: 1, action: 2, dominatedBy: [0, 1] },
    ]);
    // Round 2 (rows {0,2}, cols {0,1}): col1 vs col0 on rows 0,2: col0 (3,1), col1 (1,3): none; rows: r0 (4,3) vs r2 (3,4): none.
    expect(res.surviving).toEqual([[0, 2], [0, 1]]);
    expect(res.solved).toBe(false);
    expect(res.orderDependent).toBe(false);
    expect(res.possibleResults).toEqual([res.surviving]);
  });

  it('fully solvable 3x3', () => {
    const g = game(
      [
        [3, 2, 4],
        [1, 0, 2],
        [2, 1, 0],
      ],
      [
        [2, 3, 1],
        [1, 2, 0],
        [0, 1, 3],
      ],
    );
    const res = iesds(g);
    expect(res.solved).toBe(true);
    expect(res.surviving).toEqual([[0], [1]]);
  });
});

describe('iterated weak dominance', () => {
  it('flags order dependence even when the simultaneous procedure is unique', () => {
    const res = iteratedWeakDominance(game([[1, 0], [1, 2], [0, 2]], [[1, 0], [1, 1], [0, 1]]));
    expect(res.orderDependent).toBe(true);
    // {M}x{L,R}, {M,B}x{R}, {T,M}x{L}, {M}x{R}, {M}x{L} (see golden fixture for the hand enumeration)
    expect(res.possibleResults).toHaveLength(5);
    expect(res.orderSearchComplete).toBe(true);
    expect(res.warning).toMatch(/order/);
  });

  it('a subtle order-dependent case: removing the column first protects a weakly dominated row', () => {
    // Row 1 is weakly dominated (tie against column 0); column 1 is strictly dominated.
    const res = iteratedWeakDominance(game([[1, 1], [1, 0]], [[1, 0], [1, 0]]));
    expect(res.orderDependent).toBe(true);
    expect(res.possibleResults).toEqual([[[0, 1], [0]], [[0], [0]]]);
  });

  it('order-independent case', () => {
    const res = iteratedWeakDominance(game([[2, 1], [1, 0]], [[1, 0], [1, 0]]));
    expect(res.orderDependent).toBe(false);
    expect(res.possibleResults).toEqual([res.surviving]);
  });
});
