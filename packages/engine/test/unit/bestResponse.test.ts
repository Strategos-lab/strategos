import { describe, expect, it } from 'vitest';
import { bestResponses, bestResponseTable, bestResponseToMixed, expectedPayoffs, pureAsMixed } from '../../src/index.js';
import { game, strs } from '../helpers.js';

describe('best responses', () => {
  const g = game([[3, 1], [3, 0], [2, 4]], [[1, 0], [2, 2], [0, 5]]); // 3x2

  it('to a pure action, ties included, both players', () => {
    expect(bestResponses(g, 0, 0)).toEqual([0, 1]);
    expect(bestResponses(g, 0, 1)).toEqual([2]);
    expect(bestResponses(g, 1, 0)).toEqual([0]);
    expect(bestResponses(g, 1, 1)).toEqual([0, 1]);
    expect(bestResponses(g, 1, 2)).toEqual([1]);
  });

  it('validates arguments', () => {
    expect(() => bestResponses(g, 2, 0)).toThrow(/player/);
    expect(() => bestResponses(g, 0, 2)).toThrow(/out of range/);
    expect(() => bestResponses(g, 1, 3)).toThrow(/out of range/);
  });

  it('table lists payoffs and best sets per opponent action', () => {
    const t = bestResponseTable(g, 1);
    expect(t).toHaveLength(3);
    expect(strs(t[2]!.payoffs)).toEqual(['0', '5']);
    expect(t[2]!.best).toEqual([1]);
    expect(t[2]!.bestValue.toString()).toBe('5');
  });

  it('to a mixed belief with exact expected payoffs and exact ties', () => {
    // Against (1/3, 2/3): row0 = 3/3 + 2/3 = 5/3, row1 = 1, row2 = 2/3 + 8/3 = 10/3
    const res = bestResponseToMixed(g, 0, ['1/3', '2/3']);
    expect(strs(res.expected)).toEqual(['5/3', '1', '10/3']);
    expect(res.best).toEqual([2]);
    // Exact tie: against (4/5, 1/5) rows: 13/5, 12/5, 12/5 -> row0 best; at (2/3,1/3): 7/3, 2, 8/3
    const tie = bestResponseToMixed(game([[1, 0], [0, 1]], [[0, 0], [0, 0]]), 0, ['1/2', '1/2']);
    expect(tie.best).toEqual([0, 1]);
    expect(tie.value.toString()).toBe('1/2');
  });

  it('rejects invalid distributions', () => {
    expect(() => bestResponseToMixed(g, 0, ['1/2', '1/3'])).toThrow(/sum to exactly 1/);
    expect(() => bestResponseToMixed(g, 0, ['3/2', '-1/2'])).toThrow(/non-negative/);
    expect(() => bestResponseToMixed(g, 0, ['1'])).toThrow(/expected 2/);
  });

  it('expected payoffs of mixed profiles', () => {
    const mp = game([[1, -1], [-1, 1]], [[-1, 1], [1, -1]]);
    expect(strs(expectedPayoffs(mp, [['1/2', '1/2'], ['1/2', '1/2']]))).toEqual(['0', '0']);
    expect(strs(expectedPayoffs(mp, [pureAsMixed(0, 2), ['1/3', '2/3']]))).toEqual(['-1/3', '1/3']);
  });
});
