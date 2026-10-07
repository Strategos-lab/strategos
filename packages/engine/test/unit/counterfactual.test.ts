import { describe, expect, it } from 'vitest';
import { counterfactuals, type Sequential2Game } from '../../src/index.js';
import { game, strs } from '../helpers.js';

describe('counterfactuals', () => {
  const pd = game([[3, 0], [5, 1]], [[3, 5], [0, 1]]);

  it('normal game: alternatives vs the same opponent action + hypothetical reactive opponent', () => {
    const cf = counterfactuals(pd, 0, [0, 1]);
    expect(cf.reactiveModel).toBe('hypothetical-observing-best-response');
    expect(strs(cf.realisedPayoffs)).toEqual(['0', '5']);
    expect(cf.alternatives[1]!.profile).toEqual([1, 1]);
    expect(strs(cf.alternatives[1]!.payoffs)).toEqual(['1', '1']);
    expect(cf.alternatives[1]!.ownDifference.toString()).toBe('1');
    expect(cf.alternatives[0]!.ownDifference.toString()).toBe('0');
    expect(cf.alternatives[0]!.reactiveOpponent!.responses).toEqual([1]);
  });

  it('column player perspective', () => {
    const cf = counterfactuals(pd, 1, [1, 0]);
    expect(cf.alternatives.map((a) => a.profile)).toEqual([[1, 0], [1, 1]]);
    expect(cf.alternatives[1]!.ownDifference.toString()).toBe('1');
    expect(cf.alternatives[0]!.reactiveOpponent!.outcomes[0]!.profile).toEqual([1, 0]);
  });

  it('sequential2: the leader sees the follower\'s real response function; the follower has no reactive opponent', () => {
    const seq: Sequential2Game = { ...game([[2, -1], [0, 0]], [[1, -1], [3, 3]]), kind: 'sequential2' };
    const leader = counterfactuals(seq, 0, [1, 1]);
    expect(leader.reactiveModel).toBe('follower-best-response');
    expect(leader.alternatives[0]!.reactiveOpponent!.responses).toEqual([0]);
    expect(strs(leader.alternatives[0]!.reactiveOpponent!.outcomes[0]!.payoffs)).toEqual(['2', '1']);
    expect(leader.alternatives[1]!.reactiveOpponent!.responses).toEqual([0, 1]);
    const follower = counterfactuals(seq, 1, [0, 1]);
    expect(follower.reactiveModel).toBe('none');
    expect(follower.alternatives[0]!.reactiveOpponent).toBeNull();
  });

  it('validates the realised profile', () => {
    expect(() => counterfactuals(pd, 0, [0, 2])).toThrow();
    expect(() => counterfactuals(pd, 3, [0, 0])).toThrow();
  });
});
