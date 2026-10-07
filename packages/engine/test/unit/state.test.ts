import { describe, expect, it } from 'vitest';
import { initialState, isTerminal, legalActions, makeNormalGame, payoffs, playersToMove, step, type RepeatedGame, type Sequential2Game } from '../../src/index.js';

const pd = makeNormalGame([[3, 0], [5, 1]], [[3, 5], [0, 1]]);
const seq: Sequential2Game = { ...makeNormalGame([[2, -1], [0, 0]], [[1, -1], [3, 3]]), kind: 'sequential2' };

describe('state machine: normal', () => {
  it('simultaneous commits in any order; terminal after both; payoffs', () => {
    let s = initialState(pd);
    expect(isTerminal(pd, s)).toBe(false);
    expect(playersToMove(pd, s)).toEqual([0, 1]);
    expect(legalActions(pd, s, 1)).toEqual([0, 1]);
    expect(() => payoffs(pd, s)).toThrow(/not terminal/);
    s = step(pd, s, { player: 1, action: 0 });
    expect(playersToMove(pd, s)).toEqual([0]);
    expect(legalActions(pd, s, 1)).toEqual([]);
    expect(() => step(pd, s, { player: 1, action: 1 })).toThrow(/illegal move/);
    s = step(pd, s, { player: 0, action: 1 });
    expect(isTerminal(pd, s)).toBe(true);
    expect(playersToMove(pd, s)).toEqual([]);
    expect(payoffs(pd, s).map(String)).toEqual(['5', '0']);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it('rejects out-of-range actions and mismatched states', () => {
    const s = initialState(pd);
    expect(() => step(pd, s, { player: 0, action: 2 })).toThrow();
    expect(() => step(pd, s, { player: 2, action: 0 })).toThrow();
    expect(() => isTerminal(seq, s)).toThrow(/does not match/);
  });
});

describe('state machine: sequential2', () => {
  it('leader then follower', () => {
    let s = initialState(seq);
    expect(playersToMove(seq, s)).toEqual([0]);
    expect(legalActions(seq, s, 1)).toEqual([]);
    s = step(seq, s, { player: 0, action: 0 });
    expect(playersToMove(seq, s)).toEqual([1]);
    s = step(seq, s, { player: 1, action: 1 });
    expect(isTerminal(seq, s)).toBe(true);
    expect(payoffs(seq, s).map(String)).toEqual(['-1', '-1']);
  });
});

describe('state machine: repeated', () => {
  const fixed: RepeatedGame = { kind: 'repeated', schemaVersion: 1, stage: pd, horizon: { type: 'fixed', rounds: 2 }, monitoring: 'perfect' };
  const cont: RepeatedGame = { ...fixed, horizon: { type: 'continuation', delta: '1/2' } };

  it('fixed horizon ends after T rounds with cumulative payoffs', () => {
    let s = initialState(fixed);
    for (let t = 0; t < 2; t++) {
      s = step(fixed, s, { player: 0, action: 0 });
      expect(payoffs(fixed, s).map(String)).toEqual(t === 0 ? ['0', '0'] : ['3', '3']);
      s = step(fixed, s, { player: 1, action: t });
    }
    expect(isTerminal(fixed, s)).toBe(true);
    expect(s.kind === 'repeated' && s.endReason).toBe('fixed-horizon');
    expect(payoffs(fixed, s).map(String)).toEqual(['3', '8']);
  });

  it('continuation horizon needs a seed and is reproducible', () => {
    expect(() => initialState(cont)).toThrow(/seed/);
    expect(() => initialState(cont, { seed: 1, maxRounds: 0 })).toThrow(/maxRounds/);
    const run = (seed: number) => {
      let s = initialState(cont, { seed });
      while (!isTerminal(cont, s)) {
        s = step(cont, s, { player: 0, action: 1 });
        s = step(cont, s, { player: 1, action: 1 });
      }
      return s;
    };
    expect(run(7)).toEqual(run(7));
    const lengths = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => (run(k) as { history: unknown[] }).history.length));
    expect(lengths.size).toBeGreaterThan(1);
  });

  it('max-rounds safety cap', () => {
    const nearOne: RepeatedGame = { ...fixed, horizon: { type: 'continuation', delta: '999999/1000000' } };
    let s = initialState(nearOne, { seed: 1, maxRounds: 3 });
    while (!isTerminal(nearOne, s)) {
      s = step(nearOne, s, { player: 0, action: 0 });
      s = step(nearOne, s, { player: 1, action: 0 });
    }
    expect(s.kind === 'repeated' && s.endReason).toBe('max-rounds');
    expect(s.kind === 'repeated' && s.history.length).toBe(3);
  });
});
