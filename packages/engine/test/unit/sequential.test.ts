import { describe, expect, it } from 'vitest';
import { backwardInduction, compareWithSimultaneous, followerBestResponses, toSimultaneous, validateGame, type Sequential2Game } from '../../src/index.js';
import { game } from '../helpers.js';

const seq = (A: number[][], B: number[][], extra: Partial<Sequential2Game> = {}): Sequential2Game => ({ ...game(A, B), kind: 'sequential2', ...extra });

describe('sequential2', () => {
  it('toSimultaneous keeps players and payoffs and is a valid normal game', () => {
    const s = seq([[2, -1], [0, 0]], [[1, -1], [3, 3]], { id: 'x', title: 'T' });
    const n = toSimultaneous(s);
    expect(n.kind).toBe('normal');
    expect(n.payoffs).toEqual(s.payoffs);
    expect(n.id).toBe('x:simultaneous');
    expect(n.title).toBe('T');
    expect(validateGame(n).ok).toBe(true);
    expect(() => toSimultaneous(game([[1]], [[1]]) as unknown as Sequential2Game)).toThrow();
  });

  it('tie-break policies on an on-path follower tie', () => {
    // After leader action 0 the follower is indifferent: leader gets 3 (b0) or 0 (b1); action 1 gives the leader 1.
    const s = seq([[3, 0], [1, 1]], [[2, 2], [0, 1]]);
    expect(followerBestResponses(s)).toEqual([[0, 1], [1]]);
    const all = backwardInduction(s);
    expect(all.onPathTie).toBe(true);
    expect(all.outcomes.map((o) => o.join())).toEqual(['0,0', '1,1']);
    expect(all.spe).toHaveLength(2);
    const fav = backwardInduction(s, 'leader-favourable');
    expect(fav.outcomes).toEqual([[0, 0]]);
    const unfav = backwardInduction(s, 'leader-unfavourable');
    expect(unfav.outcomes).toEqual([[1, 1]]);
  });

  it('leader indifference yields several SPE with the same plan', () => {
    const s = seq([[1, 0], [1, 0]], [[1, 0], [1, 0]]);
    const bi = backwardInduction(s);
    expect(bi.spe).toHaveLength(2);
    expect(bi.outcomes).toHaveLength(2);
  });

  it('sequential matching pennies: first-mover disadvantage', () => {
    const s = seq([[1, -1], [-1, 1]], [[-1, 1], [1, -1]]);
    const c = compareWithSimultaneous(s);
    expect(c.speLeaderPayoffs.map(String)).toEqual(['-1', '-1']);
    expect(c.firstMover).toBe('disadvantage');
  });

  it('PD: moving first changes nothing', () => {
    const c = compareWithSimultaneous(seq([[3, 0], [5, 1]], [[3, 5], [0, 1]]));
    expect(c.firstMover).toBe('none');
    expect(c.speOutcomesThatAreSimultaneousNE).toEqual([[1, 1]]);
    expect(c.simultaneousPureNENotSPEOutcome).toEqual([]);
  });

  it('commitment advantage in a coordination game; ambiguous effects are reported as such', () => {
    // BoS sequential: leader picks its favourite -> advantage vs simultaneous NE payoffs {2, 1, 2/3}.
    expect(compareWithSimultaneous(seq([[2, 0], [0, 1]], [[1, 0], [0, 2]])).firstMover).toBe('advantage');
    // Leader SPE payoffs {3, 1} (tie-dependent) vs simultaneous NE payoffs including 3 and 1 -> ambiguous.
    expect(compareWithSimultaneous(seq([[3, 0], [1, 1]], [[2, 2], [0, 1]])).firstMover).toBe('ambiguous');
  });

  it('refuses absurdly many follower plans', () => {
    const z = Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => 0)); // 6^7 tied plans
    expect(() => backwardInduction(seq(z, z))).toThrow(/too many/);
  });
});
