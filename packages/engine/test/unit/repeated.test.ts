import { describe, expect, it } from 'vitest';
import {
  ALL_C,
  ALL_D,
  BEHAVIOURAL_STRATEGY_NOTE,
  defaultRoles,
  expectedRepeatedPayoffs,
  finiteHorizonUnravelling,
  GRIM_TRIGGER,
  grimTriggerThreshold,
  isGrimSustainable,
  randomStrategy,
  simulateRepeated,
  STANDARD_STRATEGIES,
  TIT_FOR_TAT,
  TIT_FOR_TWO_TATS,
  WIN_STAY_LOSE_SHIFT,
  Rational,
  type RepeatedGame,
  type RepeatedStrategy,
} from '../../src/index.js';
import { game, strs } from '../helpers.js';

const pdStage = game([[3, 0], [5, 1]], [[3, 5], [0, 1]], { rowActions: ['C', 'D'], colActions: ['C', 'D'] });
const fixed = (T: number, stage = pdStage): RepeatedGame => ({ kind: 'repeated', schemaVersion: 1, stage, horizon: { type: 'fixed', rounds: T }, monitoring: 'perfect' });
const cont = (delta: string, stage = pdStage): RepeatedGame => ({ kind: 'repeated', schemaVersion: 1, stage, horizon: { type: 'continuation', delta }, monitoring: 'perfect' });
const C = 0;
const D = 1;
const oppMoves = (sim: ReturnType<typeof simulateRepeated>) => sim.rounds.map((r) => r.actions[1]);

describe('automata and discipline labels', () => {
  it('every standard strategy carries a discipline label; TFT & co are behavioural, Grim is GT', () => {
    for (const s of STANDARD_STRATEGIES) expect(s.discipline).toBeTruthy();
    for (const s of [ALL_C, ALL_D, TIT_FOR_TAT, TIT_FOR_TWO_TATS, WIN_STAY_LOSE_SHIFT, randomStrategy('1/2')]) {
      expect(s.disciplineNote).toBe(BEHAVIOURAL_STRATEGY_NOTE);
      expect(s.discipline).toBe('COMPUTATIONAL');
    }
    expect(BEHAVIOURAL_STRATEGY_NOTE).toBe('behavioural strategy (Axelrod tournaments); not an equilibrium concept');
    expect(GRIM_TRIGGER.discipline).toBe('GT');
    expect(GRIM_TRIGGER.disciplineNote).toMatch(/subgame-perfect equilibrium/);
    expect(() => randomStrategy('3/2')).toThrow();
  });
});

describe('simulateRepeated', () => {
  it('Tit-for-Tat copies the user\'s previous move', () => {
    const sim = simulateRepeated(fixed(4), [C, D, C, C], TIT_FOR_TAT, { seed: 1 });
    expect(oppMoves(sim)).toEqual([C, C, D, C]);
    expect(strs(sim.totals)).toEqual(['11', '11']);
    expect(sim.endReason).toBe('fixed-horizon');
    expect(sim.discountedTotals).toBeNull();
    expect(sim.finalStates).toEqual([null, 'c']);
  });

  it('Grim Trigger never forgives', () => {
    expect(oppMoves(simulateRepeated(fixed(4), [D, C, C, C], GRIM_TRIGGER, { seed: 1 }))).toEqual([C, D, D, D]);
  });

  it('Win-Stay, Lose-Shift', () => {
    expect(oppMoves(simulateRepeated(fixed(4), [C, D, D, C], WIN_STAY_LOSE_SHIFT, { seed: 1 }))).toEqual([C, C, D, C]);
  });

  it('Tit-for-Two-Tats retaliates only after two defections', () => {
    expect(oppMoves(simulateRepeated(fixed(4), [D, D, C, D], TIT_FOR_TWO_TATS, { seed: 1 }))).toEqual([C, C, D, C]);
    expect(oppMoves(simulateRepeated(fixed(4), [D, C, D, C], TIT_FOR_TWO_TATS, { seed: 1 }))).toEqual([C, C, C, C]);
  });

  it('AllC / AllD / Random(0) / Random(1)', () => {
    expect(oppMoves(simulateRepeated(fixed(3), [D, D, D], ALL_C, { seed: 1 }))).toEqual([C, C, C]);
    expect(oppMoves(simulateRepeated(fixed(3), [C, C, C], ALL_D, { seed: 1 }))).toEqual([D, D, D]);
    expect(oppMoves(simulateRepeated(fixed(3), [C, C, C], randomStrategy(0), { seed: 1 }))).toEqual([D, D, D]);
    expect(oppMoves(simulateRepeated(fixed(3), [C, C, C], randomStrategy(1), { seed: 1 }))).toEqual([C, C, C]);
  });

  it('Random(p) is reproducible for a seed and varies across seeds', () => {
    const run = (seed: number | string) => oppMoves(simulateRepeated(fixed(40), Array(40).fill(C), randomStrategy('1/2'), { seed }));
    expect(run(123)).toEqual(run(123));
    expect(run('abc')).toEqual(run('abc'));
    expect(run(123)).not.toEqual(run(124));
  });

  it('continuation horizon: reproducible length, exact discounted totals', () => {
    const g = cont('3/4');
    const a = simulateRepeated(g, ALL_C, ALL_C, { seed: 9 });
    const b = simulateRepeated(g, ALL_C, ALL_C, { seed: 9 });
    expect(a).toEqual(b);
    expect(a.endReason).toBe('continuation-ended');
    const n = a.rounds.length;
    // Exact closed form: sum_{t<n} 3 (3/4)^t = 12 (1 - (3/4)^n).
    const want = Rational.of(12).mul(Rational.ONE.sub(Rational.of(3, 4).pow(n)));
    expect(a.discountedTotals![0].eq(want)).toBe(true);
    expect(a.totals[0].eq(3 * n)).toBe(true);
  });

  it('moves exhausted, user policy functions, user strategies, userPlayer = 1', () => {
    expect(simulateRepeated(cont('99/100'), [C, C], ALL_C, { seed: 3 }).endReason).toMatch(/moves-exhausted|continuation-ended/);
    expect(simulateRepeated(fixed(5), [C, C], ALL_C, { seed: 3 })).toMatchObject({ endReason: 'moves-exhausted' });
    const policy = simulateRepeated(fixed(3), (h) => (h.length === 0 ? D : h[h.length - 1]!.actions[1]), TIT_FOR_TAT, { seed: 1 });
    expect(policy.rounds.map((r) => r.actions)).toEqual([[D, C], [C, D], [D, C]]);
    const both = simulateRepeated(fixed(3), TIT_FOR_TAT, TIT_FOR_TAT, { seed: 1 });
    expect(strs(both.totals)).toEqual(['9', '9']);
    expect(both.finalStates).toEqual(['c', 'c']);
    const asCol = simulateRepeated(fixed(2), [D, D], TIT_FOR_TAT, { seed: 1, userPlayer: 1 });
    expect(asCol.rounds.map((r) => r.actions)).toEqual([[C, D], [D, D]]);
  });

  it('horizon override and max-rounds cap', () => {
    const sim = simulateRepeated(fixed(10), ALL_D, ALL_D, { seed: 1, horizon: { type: 'fixed', rounds: 2 } });
    expect(sim.rounds).toHaveLength(2);
    const capped = simulateRepeated(cont('999999/1000000'), ALL_C, ALL_C, { seed: 1, maxRounds: 5 });
    expect(capped.endReason).toBe('max-rounds');
    expect(capped.rounds).toHaveLength(5);
  });

  it('validates moves, policies, roles and strategies', () => {
    expect(() => simulateRepeated(fixed(2), [0, 2], ALL_C, { seed: 1 })).toThrow(/out of range/);
    expect(() => simulateRepeated(fixed(2), () => 7, ALL_C, { seed: 1 })).toThrow(/illegal action/);
    expect(() => simulateRepeated(fixed(2), [0], ALL_C, { seed: 1, roles: [{ C: 0, D: 0 }, { C: 0, D: 1 }] })).toThrow(/roles/);
    const bad: RepeatedStrategy = { ...ALL_C, initial: 'zz' };
    expect(() => simulateRepeated(fixed(2), [0], bad, { seed: 1 })).toThrow(/initial/);
    const badNext: RepeatedStrategy = { ...ALL_C, states: { c: { play: 'C', next: { C: 'c', D: 'nope' } } } };
    expect(() => simulateRepeated(fixed(2), [0], badNext, { seed: 1 })).toThrow(/next state/);
    const badP: RepeatedStrategy = { ...ALL_C, states: { c: { play: { cooperateProbability: '2' }, next: { C: 'c', D: 'c' } } } };
    expect(() => simulateRepeated(fixed(2), [0], badP, { seed: 1 })).toThrow(/probability/);
    const s3 = game([[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 3]]);
    expect(() => simulateRepeated(fixed(2, s3), [0], ALL_C, { seed: 1 })).toThrow(/2x2/);
  });

  it('default roles follow the PD classification, else action 0 = C', () => {
    const swapped = game([[5, 1], [3, 0]], [[0, 1], [3, 5]]); // row action 1 is C
    expect(defaultRoles(swapped)).toEqual([{ C: 1, D: 0 }, { C: 0, D: 1 }]);
    expect(defaultRoles(game([[1, 0], [0, 1]], [[1, 0], [0, 1]]))).toEqual([{ C: 0, D: 1 }, { C: 0, D: 1 }]);
  });
});

describe('exact expected totals', () => {
  it('Grim vs Grim and AllD vs Grim at delta = 9/10', () => {
    expect(strs(expectedRepeatedPayoffs(cont('9/10'), [GRIM_TRIGGER, GRIM_TRIGGER]))).toEqual(['30', '30']);
    expect(strs(expectedRepeatedPayoffs(cont('9/10'), [ALL_D, GRIM_TRIGGER]))).toEqual(['14', '9']);
  });
  it('fixed horizon and stochastic strategies', () => {
    expect(strs(expectedRepeatedPayoffs(fixed(3), [TIT_FOR_TAT, ALL_D]))).toEqual(['2', '7']);
    expect(strs(expectedRepeatedPayoffs(fixed(1), [randomStrategy('1/2'), ALL_C]))).toEqual(['4', '3/2']);
    // Random(1/2) vs TFT over 2 rounds: round 1 (1/2 C): row 4, col 3/2; round 2 TFT copies row's round-1 move.
    // Round 2 row: P(row C, TFT C)=1/4 ->3, (D,C)=1/4 ->5, (C,D)=1/4 ->0, (D,D)=1/4 ->1 => 9/4. Total 4 + 9/4 = 25/4.
    expect(expectedRepeatedPayoffs(fixed(2), [randomStrategy('1/2'), TIT_FOR_TAT])[0].toString()).toBe('25/4');
  });
  it('horizon override', () => {
    expect(strs(expectedRepeatedPayoffs(fixed(9), [ALL_C, ALL_C], { horizon: { type: 'fixed', rounds: 2 } }))).toEqual(['6', '6']);
  });
});

describe('grim trigger threshold', () => {
  it('delta* = (T - R) / (T - P) for several payoff sets', () => {
    expect(grimTriggerThreshold(pdStage).deltaStar!.toString()).toBe('1/2');
    expect(grimTriggerThreshold(game([[4, 0], [6, 1]], [[4, 6], [0, 1]])).deltaStar!.toString()).toBe('2/5');
    expect(grimTriggerThreshold(game([['7/2', 0], [4, '1/2']], [['7/2', 4], [0, '1/2']])).deltaStar!.toString()).toBe('1/7');
    // Asymmetric (ordinally symmetric) PD: max over players.
    const asym = grimTriggerThreshold(game([[3, 0], [5, 1]], [[2, 9], [0, 1]]));
    expect(strs(asym.perPlayer!)).toEqual(['1/2', '7/8']);
    expect(asym.deltaStar!.toString()).toBe('7/8');
  });
  it('not applicable to non-PD stage games', () => {
    const th = grimTriggerThreshold(game([[4, 0], [3, 2]], [[4, 3], [0, 2]]));
    expect(th).toMatchObject({ applicable: false, deltaStar: null });
    expect(th.reason).toMatch(/stag_hunt/);
    expect(isGrimSustainable(game([[4, 0], [3, 2]], [[4, 3], [0, 2]]), '1/2')).toMatchObject({ applicable: false, sustainable: null });
  });
  it('sustainability uses the weak inequality and matches the value comparison', () => {
    expect(isGrimSustainable(pdStage, '1/2').sustainable).toBe(true);
    expect(isGrimSustainable(pdStage, '49/100').sustainable).toBe(false);
    const at = isGrimSustainable(pdStage, '1/2');
    expect(at.cooperateValue![0].eq(at.deviateValue![0])).toBe(true);
    expect(() => isGrimSustainable(pdStage, '1')).toThrow();
  });
});

describe('finite-horizon unravelling', () => {
  it('PD with known T: defect in every round', () => {
    const u = finiteHorizonUnravelling(fixed(3));
    expect(u.applies).toBe(true);
    expect(u.steps.map((s) => [s.round, s.argument])).toEqual([
      [3, 'last-round-is-one-shot'],
      [2, 'future-play-fixed-so-round-is-one-shot'],
      [1, 'future-play-fixed-so-round-is-one-shot'],
    ]);
    expect(u.stageEquilibrium!.map(strs)).toEqual([['0', '1'], ['0', '1']]);
  });
  it('does not apply with several stage equilibria or an indefinite horizon', () => {
    expect(finiteHorizonUnravelling(fixed(3, game([[4, 0], [3, 2]], [[4, 3], [0, 2]]))).applies).toBe(false);
    expect(finiteHorizonUnravelling(cont('1/2')).applies).toBe(false);
  });
  it('a unique MIXED stage equilibrium is played every round (matching pennies)', () => {
    const u = finiteHorizonUnravelling(fixed(2, game([[1, -1], [-1, 1]], [[-1, 1], [1, -1]])));
    expect(u.applies).toBe(true);
    expect(u.stageEquilibrium!.map(strs)).toEqual([['1/2', '1/2'], ['1/2', '1/2']]);
  });
});
