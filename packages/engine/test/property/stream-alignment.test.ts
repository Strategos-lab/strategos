/**
 * Counterfactual-replay alignment (plan §11.3): each player and the termination process have their
 * own seeded stream, advanced exactly once per round, so changing the user's moves or how the user
 * is specified never changes the opponent's random draws or the number of rounds.
 */
import { describe, expect, it } from 'vitest';
import { ALL_C, makeNormalGame, randomStrategy, simulateRepeated, type RepeatedGame } from '../../src/index.js';

const g: RepeatedGame = {
  kind: 'repeated',
  schemaVersion: 1,
  stage: makeNormalGame([[3, 0], [5, 1]], [[3, 5], [0, 1]]),
  horizon: { type: 'continuation', delta: '9/10' },
  monitoring: 'perfect',
};

describe('RNG stream alignment for counterfactual replays', () => {
  it('user as moves vs user as an equivalent automaton gives identical runs', () => {
    const opp = randomStrategy('1/2');
    const asAutomaton = simulateRepeated(g, ALL_C, opp, { seed: 2026 });
    const asMoves = simulateRepeated(g, Array(asAutomaton.rounds.length + 5).fill(0), opp, { seed: 2026 });
    expect(asMoves.rounds).toEqual(asAutomaton.rounds);
    expect(asMoves.endReason).toBe(asAutomaton.endReason);
  });

  it('changing the user\'s moves never changes the opponent\'s random draws or the number of rounds', () => {
    const opp = randomStrategy('1/3');
    const a = simulateRepeated(g, Array(500).fill(0), opp, { seed: 7 });
    const b = simulateRepeated(g, Array(500).fill(1), opp, { seed: 7 });
    expect(b.rounds.length).toBe(a.rounds.length);
    expect(b.rounds.map((r) => r.actions[1])).toEqual(a.rounds.map((r) => r.actions[1]));
  });
});
