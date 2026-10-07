import { describe, expect, it } from 'vitest';
import {
  checkNash,
  indifference2x2,
  isDegenerate,
  isNashEquilibrium,
  MAX_EXHAUSTIVE_ACTIONS,
  pureNash,
  solveEquilibria,
  supportBestResponses,
  supportEnumeration,
} from '../../src/index.js';
import { game, mixedSet, profileSet, strs } from '../helpers.js';

describe('pure Nash equilibria', () => {
  it('handles ties (weak best responses count)', () => {
    const g = game([[1, 1], [1, 1]], [[0, 0], [0, 0]]);
    expect(profileSet(pureNash(g))).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });
  it('none in matching pennies', () => {
    expect(pureNash(game([[1, -1], [-1, 1]], [[-1, 1], [1, -1]]))).toEqual([]);
  });
});

describe('solveEquilibria: 2x2 complete sets', () => {
  it('matching pennies: never "no equilibrium" — unique mixed (1/2, 1/2)', () => {
    const eq = solveEquilibria(game([[1, -1], [-1, 1]], [[-1, 1], [1, -1]]));
    expect(eq.pure).toEqual([]);
    expect(mixedSet(eq.mixed)).toEqual(['1/2 1/2 | 1/2 1/2']);
    expect(eq.complete).toBe(true);
    expect(eq.existenceGuaranteed).toBe(true);
    expect(eq.method).toBe('extreme-equilibrium-enumeration');
  });

  it('asymmetric mixed equilibrium with unequal probabilities', () => {
    // Row: A=[[3,0],[0,1]] -> col mixes q with 3q = 1-q -> q=1/4. Col: B=[[0,2],[1,0]] -> row mixes p: 0p+1(1-p) = 2p -> p=1/3.
    const eq = solveEquilibria(game([[3, 0], [0, 1]], [[0, 2], [1, 0]]));
    expect(eq.pure).toEqual([]);
    expect(mixedSet(eq.mixed)).toEqual(['1/3 2/3 | 1/4 3/4']);
  });

  it('constant payoff column for one player -> continuum, flagged degenerate, not a crash', () => {
    // Row is indifferent in column 0; see golden "picnic spot" for the full hand derivation.
    const eq = solveEquilibria(game([[2, 0], [2, 1]], [[1, 0], [0, 1]]));
    expect(eq.degenerate).toBe(true);
    expect(eq.finite).toBe(false);
    expect(eq.continua).toHaveLength(1);
    expect(eq.continua[0]!.shape).toBe('segment');
    expect(eq.continua[0]!.dimension).toBe(1);
    expect(strs(eq.continua[0]!.payoffRange[1])).toEqual(['1/2', '1']);
  });

  it('a player indifferent everywhere -> the other player best-responds; continuum over the indifferent player', () => {
    // Row payoffs constant; column prefers c0 against r0 and c1 against r1.
    const eq = solveEquilibria(game([[5, 5], [5, 5]], [[1, 0], [0, 1]]));
    // Equilibria: (r0 w.p. x >= 1/2, c0), (x <= 1/2, c1), and (x = 1/2, any y).
    expect(eq.continua).toHaveLength(3);
    expect(eq.pure).toHaveLength(2);
    for (const c of eq.continua) {
      for (const x of c.vertices[0]) for (const y of c.vertices[1]) expect(isNashEquilibrium(game([[5, 5], [5, 5]], [[1, 0], [0, 1]]), [x, y])).toBe(true);
    }
  });

  it('all payoffs equal: whole strategy space, a 2-dimensional continuum', () => {
    const eq = solveEquilibria(game([[1, 1], [1, 1]], [[1, 1], [1, 1]]));
    expect(eq.continua).toHaveLength(1);
    expect(eq.continua[0]!.dimension).toBe(2);
    expect(eq.continua[0]!.shape).toBe('polytope');
  });

  it('pure NE in a continuum is still listed in `pure`', () => {
    const eq = solveEquilibria(game([[2, 0], [2, 1]], [[1, 0], [0, 1]]));
    expect(profileSet(eq.pure)).toEqual(['0,0', '1,1']);
  });

  it('handles negative and fractional payoffs (shift to positive is internal)', () => {
    const eq = solveEquilibria(game([['-1/2', '-3'], ['-3', '-1']], [['-1', '-3'], ['-3', '-1/2']]));
    expect(eq.pure).toHaveLength(2);
    expect(eq.mixed).toHaveLength(1);
    expect(checkNash(game([['-1/2', '-3'], ['-3', '-1']], [['-1', '-3'], ['-3', '-1/2']]), eq.mixed[0]!).isNash).toBe(true);
  });
});

describe('solveEquilibria: larger games', () => {
  it('RPS unique mixed (1/3,1/3,1/3); nondegenerate', () => {
    const A = [[0, -1, 1], [1, 0, -1], [-1, 1, 0]];
    const B = A.map((r) => r.map((x) => -x));
    const eq = solveEquilibria(game(A, B));
    expect(eq.pure).toEqual([]);
    expect(mixedSet(eq.mixed)).toEqual(['1/3 1/3 1/3 | 1/3 1/3 1/3']);
    expect(eq.degenerate).toBe(false);
  });

  it('3x3 with several equilibria including partially mixed ones (cross-checked by support enumeration)', () => {
    const A = [[3, 0, 0], [0, 2, 0], [0, 0, 1]];
    const g = game(A, A);
    const eq = solveEquilibria(g);
    // Pure coordination 3x3: 3 pure, 3 two-action mixes, 1 full mix = 7 equilibria.
    expect(eq.pure).toHaveLength(3);
    expect(eq.mixed).toHaveLength(4);
    expect(mixedSet(eq.mixed)).toContain('2/11 3/11 6/11 | 2/11 3/11 6/11');
    const se = supportEnumeration(g);
    expect(se.degenerate).toBe(false);
    expect(se.complete).toBe(true);
    expect(mixedSet(se.equilibria)).toEqual(mixedSet(eq.extremeEquilibria));
  });

  it('returns complete=false with a reason above the size limit, never "no equilibrium"', () => {
    const k = MAX_EXHAUSTIVE_ACTIONS + 1;
    const A = Array.from({ length: k }, (_, i) => Array.from({ length: 2 }, (_, j) => ((i + j) % 2 === 0 ? 1 : -1)));
    const B = A.map((r) => r.map((x) => -x));
    const eq = solveEquilibria(game(A, B));
    expect(eq.complete).toBe(false);
    expect(eq.incompleteReason).toMatch(/Nash's theorem/);
    expect(eq.finite).toBeNull();
    expect(eq.existenceGuaranteed).toBe(true);
    expect(eq.method).toBe('pure-enumeration-only');
  });
});

describe('support enumeration (cross-check engine)', () => {
  it('flags degenerate games as not certified complete', () => {
    const se = supportEnumeration(game([[2, 0], [2, 1]], [[1, 0], [0, 1]]));
    expect(se.degenerate).toBe(true);
    expect(se.complete).toBe(false);
  });
});

describe('checkNash / isDegenerate / supportBestResponses', () => {
  const bos = game([[2, 0], [0, 1]], [[1, 0], [0, 2]]);
  it('exact deviation gains', () => {
    const c = checkNash(bos, [['1', '0'], ['0', '1']]);
    expect(c.isNash).toBe(false);
    expect(strs(c.deviationGains)).toEqual(['1', '1']);
    expect(checkNash(bos, [['2/3', '1/3'], ['1/3', '2/3']]).isNash).toBe(true);
    expect(isNashEquilibrium(bos, [['2/3', '1/3'], ['1/2', '1/2']])).toBe(false);
  });
  it('degeneracy', () => {
    expect(isDegenerate(bos)).toBe(false);
    expect(isDegenerate(game([[1, 1], [0, 0]], [[1, 0], [0, 1]]))).toBe(false);
    expect(isDegenerate(game([[1, 0], [0, 1]], [[1, 1], [0, 1]]))).toBe(true);
  });
  it('support best responses', () => {
    expect(supportBestResponses(bos, [['2/3', '1/3'], ['1/3', '2/3']])).toEqual([[0, 1], [0, 1]]);
  });
});

describe('indifference2x2', () => {
  it('BoS indifference mixes', () => {
    const r = indifference2x2(game([[2, 0], [0, 1]], [[1, 0], [0, 2]]));
    expect(r.indifferenceMix[0]).toMatchObject({ kind: 'unique', interior: true });
    expect(mixedSet([r.fullyMixed!])).toEqual(['2/3 1/3 | 1/3 2/3']);
  });
  it('always / never / out-of-range cases', () => {
    const always = indifference2x2(game([[5, 5], [5, 5]], [[3, 3], [3, 3]]));
    expect(always.indifferenceMix).toEqual([{ kind: 'always' }, { kind: 'always' }]);
    expect(always.fullyMixed).toBeNull();
    const never = indifference2x2(game([[2, 2], [1, 1]], [[1, 0], [1, 0]]));
    expect(never.indifferenceMix).toEqual([{ kind: 'never' }, { kind: 'never' }]);
    const pd = indifference2x2(game([[3, 0], [5, 1]], [[3, 5], [0, 1]]));
    expect(pd.indifferenceMix[0]).toMatchObject({ kind: 'unique', inUnitInterval: false, interior: false });
    expect(pd.fullyMixed).toBeNull();
  });
  it('requires 2x2', () => {
    expect(() => indifference2x2(game([[1, 2, 3], [1, 2, 3]], [[1, 2, 3], [1, 2, 3]]))).toThrow(/2x2/);
  });
});
