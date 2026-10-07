/** Decision-quality properties and exact-arithmetic ties. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bestResponseToMixed, decisionQuality, internalConsistency, makeNormalGame, Rational } from '../../src/index.js';
import { anyIntGameArb, NUM_RUNS, toGame } from '../helpers.js';
import { distArb } from './common.js';

const params = { numRuns: NUM_RUNS };

describe('decision-quality properties', () => {
  it('regret >= 0; "not best" iff regret > 0; best set = best responses to the prior; internal consistency agrees', () => {
    fc.assert(
      fc.property(
        anyIntGameArb.chain((g) => fc.tuple(fc.constant(g), fc.constantFrom(0, 1), distArb(3))),
        fc.nat(),
        ([g, player, rawDist], pick) => {
          const G = toGame(g);
          const k = player === 0 ? g.A[0]!.length : g.A.length;
          const own = player === 0 ? g.A.length : g.A[0]!.length;
          const dist = rawDist.slice(0, k);
          const total = dist.reduce((a, b) => a.add(b), Rational.ZERO);
          if (total.isZero()) return;
          const prior = dist.map((p) => p.div(total));
          const chosen = pick % own;
          const dq = decisionQuality(G, player, prior, chosen);
          expect(dq.regret.ge(0)).toBe(true);
          expect(dq.classification === 'not best').toBe(dq.regret.gt(0));
          expect(dq.best).toEqual(bestResponseToMixed(G, player, prior).best);
          expect(internalConsistency(G, player, prior, chosen).consistent).toBe(dq.best.includes(chosen));
          if (dq.normalisedRegret) expect(dq.normalisedRegret.ge(0) && dq.normalisedRegret.le(1)).toBe(true);
        },
      ),
      params,
    );
  });

  it('exact-arithmetic tie: thirds that sum to 1 produce an exact tie, detected as "tied best"', () => {
    // Against the prior (1/3, 1/3, 1/3): action 0 pays 1/3 + 1/3 + 1/3 = 1; action 1 pays 1 + 0 + 0 = 1.
    const g = makeNormalGame([['1', '1', '1'], ['3', '0', '0']], [['0', '0', '0'], ['0', '0', '0']]);
    const dq = decisionQuality(g, 0, ['1/3', '1/3', '1/3'], 0);
    expect(dq.expected.map(String)).toEqual(['1', '1']);
    expect(dq.classification).toBe('tied best');
    // Floating point would get this wrong: 0.1 + 0.2 vs 0.3 analogue with tenths.
    const h = makeNormalGame([['1/10', '2/10'], ['3/20', '3/20']], [['0', '0'], ['0', '0']]);
    expect(decisionQuality(h, 0, ['1/2', '1/2'], 0).classification).toBe('tied best');
    expect(0.1 / 2 + 0.2 / 2 === 0.15).toBe(false); // the float trap the engine avoids
  });
});
