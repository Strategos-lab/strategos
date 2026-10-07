/** Repeated-game properties: grim threshold vs simulated deviation profits; reproducibility; unravelling. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_C,
  ALL_D,
  expectedRepeatedPayoffs,
  finiteHorizonUnravelling,
  GRIM_TRIGGER,
  grimTriggerThreshold,
  isGrimSustainable,
  randomStrategy,
  Rational,
  simulateRepeated,
  STANDARD_STRATEGIES,
  TIT_FOR_TAT,
  type RepeatedGame,
} from '../../src/index.js';
import { NUM_RUNS, toGame } from '../helpers.js';
import { pdGameArb } from './common.js';

const params = { numRuns: NUM_RUNS };
const deltaArb = fc.tuple(fc.integer({ min: 1, max: 99 }), fc.constant(100)).map(([n, d]) => Rational.of(n, d));
const rep = (stage: ReturnType<typeof toGame>, delta: Rational): RepeatedGame => ({
  kind: 'repeated',
  schemaVersion: 1,
  stage,
  horizon: { type: 'continuation', delta: delta.toString() },
  monitoring: 'perfect',
});

/** Discounted value of a deterministic simulated path: truncated sum over N rounds + exact stationary tail. */
function discountedFromSimulation(sim: ReturnType<typeof simulateRepeated>, player: 0 | 1, delta: Rational): Rational {
  let v = Rational.ZERO;
  let w = Rational.ONE;
  for (const r of sim.rounds) {
    v = v.add(w.mul(r.payoffs[player]));
    w = w.mul(delta);
  }
  const last = sim.rounds[sim.rounds.length - 1]!.payoffs[player];
  return v.add(w.mul(last).div(Rational.ONE.sub(delta)));
}

describe('repeated-game properties', () => {
  it('grim threshold matches the deviation-profit comparison computed by simulation and by the Markov-chain evaluator', () => {
    fc.assert(
      fc.property(pdGameArb, deltaArb, (g, delta) => {
        const stage = toGame(g);
        const th = grimTriggerThreshold(stage);
        expect(th.applicable).toBe(true);
        const game = rep(stage, delta);
        for (const p of [0, 1] as const) {
          // Player p deviates to Always Defect against Grim; the other player keeps Grim.
          const coop = expectedRepeatedPayoffs(game, [GRIM_TRIGGER, GRIM_TRIGGER])[p];
          const dev = expectedRepeatedPayoffs(game, p === 0 ? [ALL_D, GRIM_TRIGGER] : [GRIM_TRIGGER, ALL_D])[p];
          const fixed = { ...game, horizon: { type: 'fixed' as const, rounds: 6 } };
          const simCoop = simulateRepeated(fixed, GRIM_TRIGGER, GRIM_TRIGGER, { seed: 1, userPlayer: p });
          const simDev = simulateRepeated(fixed, ALL_D, GRIM_TRIGGER, { seed: 1, userPlayer: p });
          expect(discountedFromSimulation(simCoop, p, delta).eq(coop)).toBe(true);
          expect(discountedFromSimulation(simDev, p, delta).eq(dev)).toBe(true);
          expect(coop.ge(dev)).toBe(delta.ge(th.perPlayer![p]));
        }
        const s = isGrimSustainable(stage, delta);
        expect(s.sustainable).toBe(delta.ge(th.deltaStar!));
      }),
      params,
    );
  });

  it('simulations are reproducible with the same seed (all standard strategies, random opponents, continuation horizon)', () => {
    fc.assert(
      fc.property(
        pdGameArb,
        fc.integer({ min: 0, max: 2 ** 31 }),
        fc.constantFrom(...STANDARD_STRATEGIES, randomStrategy('1/2'), randomStrategy('2/7')),
        fc.constantFrom(...STANDARD_STRATEGIES, randomStrategy('1/3')),
        (g, seed, user, opp) => {
          const game = rep(toGame(g), Rational.of(4, 5));
          const a = simulateRepeated(game, user, opp, { seed });
          const b = simulateRepeated(game, user, opp, { seed });
          expect(a).toEqual(b);
          expect(JSON.stringify(a.rounds)).toBe(JSON.stringify(b.rounds));
        },
      ),
      params,
    );
  });

  it('different seeds give different random draws (over a batch)', () => {
    const game = rep(toGame({ A: [[3, 0], [5, 1]], B: [[3, 5], [0, 1]] }), Rational.of(19, 20));
    const runs = new Set(Array.from({ length: 20 }, (_, s) => JSON.stringify(simulateRepeated(game, ALL_C, randomStrategy('1/2'), { seed: s }).rounds)));
    expect(runs.size).toBeGreaterThan(15);
  });

  it('the exact expected total of Random(p) vs TFT agrees with the Monte-Carlo mean of seeded simulations (sanity)', () => {
    const fixed: RepeatedGame = { kind: 'repeated', schemaVersion: 1, stage: toGame({ A: [[3, 0], [5, 1]], B: [[3, 5], [0, 1]] }), horizon: { type: 'fixed', rounds: 5 }, monitoring: 'perfect' };
    const exact = expectedRepeatedPayoffs(fixed, [randomStrategy('1/2'), TIT_FOR_TAT])[0];
    let total = Rational.ZERO;
    const N = 2000;
    for (let s = 0; s < N; s++) total = total.add(simulateRepeated(fixed, randomStrategy('1/2'), TIT_FOR_TAT, { seed: s }).totals[0]);
    const mean = total.div(N);
    expect(mean.sub(exact).abs().lt(Rational.of(1, 2))).toBe(true);
  });

  it('known finite horizon with a PD stage game: backward induction gives defection in every round', () => {
    fc.assert(
      fc.property(pdGameArb, fc.integer({ min: 1, max: 12 }), (g, T) => {
        const u = finiteHorizonUnravelling({ kind: 'repeated', schemaVersion: 1, stage: toGame(g), horizon: { type: 'fixed', rounds: T }, monitoring: 'perfect' });
        expect(u.applies).toBe(true);
        expect(u.steps).toHaveLength(T);
        const th = grimTriggerThreshold(toGame(g));
        for (const s of u.steps) {
          expect(s.play[0][th.roles![0].D]!.eq(1)).toBe(true);
          expect(s.play[1][th.roles![1].D]!.eq(1)).toBe(true);
        }
      }),
      params,
    );
  });

  it('AllC vs AllC over a fixed horizon totals T * R exactly', () => {
    fc.assert(
      fc.property(pdGameArb, fc.integer({ min: 1, max: 30 }), (g, T) => {
        const stage = toGame(g);
        const game: RepeatedGame = { kind: 'repeated', schemaVersion: 1, stage, horizon: { type: 'fixed', rounds: T }, monitoring: 'perfect' };
        const th = grimTriggerThreshold(stage);
        const sim = simulateRepeated(game, ALL_C, ALL_C, { seed: 0 });
        const R0 = Rational.parse(stage.payoffs[th.roles![0].C]![th.roles![1].C]![0]!);
        expect(sim.totals[0].eq(R0.mul(T))).toBe(true);
        expect(expectedRepeatedPayoffs(game, [ALL_C, ALL_C])[0].eq(R0.mul(T))).toBe(true);
      }),
      params,
    );
  });
});
