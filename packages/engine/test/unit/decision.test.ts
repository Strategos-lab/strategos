import { describe, expect, it } from 'vitest';
import { decisionQuality, equilibriumReference, internalConsistency, outcomeQuality } from '../../src/index.js';
import { game, strs } from '../helpers.js';

const sh = game([[4, 0], [3, 2]], [[4, 3], [0, 2]]); // stag hunt

describe('decision quality (declared prior; never the realised action)', () => {
  it('best / not best with exact regret and normalised regret', () => {
    // prior: opponent plays action 0 w.p. 1/2 -> E[a0] = 2, E[a1] = 5/2
    const dq = decisionQuality(sh, 0, ['1/2', '1/2'], 0);
    expect(strs(dq.expected)).toEqual(['2', '5/2']);
    expect(dq.best).toEqual([1]);
    expect(dq.classification).toBe('not best');
    expect(dq.regret.toString()).toBe('1/2');
    expect(dq.normalisedRegret!.toString()).toBe('1');
    expect(dq.basis).toBe('declared-prior');
    expect(decisionQuality(sh, 0, ['1/2', '1/2'], 1).classification).toBe('best');
  });

  it('tied best is detected exactly (prior 2/3 makes the stag hunt player indifferent)', () => {
    const dq = decisionQuality(sh, 0, ['2/3', '1/3'], 0);
    expect(dq.classification).toBe('tied best');
    expect(dq.regret.isZero()).toBe(true);
    expect(dq.normalisedRegret).toBeNull();
  });

  it('column player orientation', () => {
    const dq = decisionQuality(sh, 1, ['1', '0'], 1);
    expect(strs(dq.expected)).toEqual(['4', '3']);
    expect(dq.classification).toBe('not best');
  });

  it('ordinal payoffs: expected values flagged as not meaningful unless the prior is degenerate', () => {
    const ord = game([[4, 0], [3, 2]], [[4, 3], [0, 2]], { payoffScale: 'ordinal' });
    expect(decisionQuality(ord, 0, ['1/2', '1/2'], 0).expectedValuesMeaningful).toBe(false);
    expect(decisionQuality(ord, 0, ['1', '0'], 0).expectedValuesMeaningful).toBe(true);
    expect(decisionQuality(sh, 0, ['1/2', '1/2'], 0).expectedValuesMeaningful).toBe(true);
  });

  it('validates inputs', () => {
    expect(() => decisionQuality(sh, 0, ['1/2', '1/3'], 0)).toThrow(/prior/);
    expect(() => decisionQuality(sh, 0, ['1/2', '1/2'], 5)).toThrow(/out of range/);
    expect(() => internalConsistency(sh, 0, ['1'], 0)).toThrow(/prediction/);
  });

  it('decision-quality functions do not accept a realised opponent action (signature check)', () => {
    expect(decisionQuality.length).toBe(4);
    expect(internalConsistency.length).toBe(4);
  });
});

describe('internal consistency (own stated prediction)', () => {
  it('consistent iff a best response to the stated prediction', () => {
    expect(internalConsistency(sh, 0, ['9/10', '1/10'], 0).consistent).toBe(true);
    const ic = internalConsistency(sh, 0, ['1/10', '9/10'], 0);
    expect(ic.consistent).toBe(false);
    expect(ic.basis).toBe('own-prediction');
    expect(ic.regret.toString()).toBe('17/10'); // E[a0] = 2/5, E[a1] = 3/10 + 18/10 = 21/10
  });
});

describe('outcome quality (hindsight; separate from decision quality)', () => {
  it('reports realised payoff and hindsight regret', () => {
    const oq = outcomeQuality(sh, 0, [0, 1]);
    expect(oq.basis).toBe('realised-outcome');
    expect(oq.realisedPayoff.toString()).toBe('0');
    expect(oq.hindsightBest).toEqual([1]);
    expect(oq.hindsightRegret.toString()).toBe('2');
    expect([oq.gameMin.toString(), oq.gameMax.toString()]).toEqual(['0', '4']);
    const col = outcomeQuality(sh, 1, [1, 0]);
    expect(col.realisedPayoff.toString()).toBe('0');
    expect(strs(col.againstRealised)).toEqual(['0', '2']);
    expect(() => outcomeQuality(sh, 0, [2, 0])).toThrow();
  });

  it('a good decision can have a bad outcome (the two are independent)', () => {
    const dq = decisionQuality(sh, 0, ['9/10', '1/10'], 0);
    const oq = outcomeQuality(sh, 0, [0, 1]);
    expect(dq.classification).toBe('best');
    expect(oq.hindsightRegret.gt(0)).toBe(true);
  });
});

describe('equilibrium reference', () => {
  it('pure and support membership', () => {
    expect(equilibriumReference(sh, 0, 0)).toMatchObject({ inSomePureEquilibrium: true, inSupportOfSomeEquilibrium: true });
    const pd = game([[3, 0], [5, 1]], [[3, 5], [0, 1]]);
    expect(equilibriumReference(pd, 1, 0)).toMatchObject({ inSomePureEquilibrium: false, inSupportOfSomeEquilibrium: false });
    const mp = game([[1, -1], [-1, 1]], [[-1, 1], [1, -1]]);
    expect(equilibriumReference(mp, 0, 1)).toMatchObject({ inSomePureEquilibrium: false, inSupportOfSomeEquilibrium: true });
  });
});
