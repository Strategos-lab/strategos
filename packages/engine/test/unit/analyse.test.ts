import { describe, expect, it } from 'vitest';
import { analyse, analyseExact, ENGINE_VERSION, toJSONValue, Rational, type RepeatedGame, type Sequential2Game } from '../../src/index.js';
import { game } from '../helpers.js';

describe('analyse facade', () => {
  const pd = game([[3, 0], [5, 1]], [[3, 5], [0, 1]]);

  it('normal game: all facts present, versioned and pure JSON', () => {
    const f = analyse(pd);
    expect(f.engineVersion).toBe(ENGINE_VERSION);
    expect(f.schemaVersion).toBe(1);
    expect(f.kind).toBe('normal');
    expect(f.matrixRole).toBe('game');
    expect(f.matrix.dimensions).toEqual([2, 2]);
    expect(f.matrix.bestResponses[0]![0]!.best).toEqual([1]);
    expect(f.matrix.dominance[1]!.strictlyDominantAction).toBe(1);
    expect(f.matrix.equilibria.pure).toEqual([[1, 1]]);
    expect(f.matrix.equilibriumPayoffs.pure).toEqual([['1', '1']]);
    expect(f.matrix.family.family).toBe('prisoners_dilemma');
    expect(f.matrix.pareto.everyEquilibriumParetoDominated).toBe(true);
    expect(f.matrix.indifference2x2).not.toBeNull();
    expect(f.matrix.mixedProbabilitiesMeaningful).toBe(true);
    expect(f.sequential).toBeNull();
    expect(f.repeated).toBeNull();
    const json = JSON.stringify(f);
    expect(JSON.parse(json)).toEqual(f);
    expect(json.replace(ENGINE_VERSION, '')).not.toMatch(/\d\.\d/); // no floats anywhere in the facts
  });

  it('is deterministic', () => {
    expect(JSON.stringify(analyse(pd))).toBe(JSON.stringify(analyse(game([[3, 0], [5, 1]], [[3, 5], [0, 1]]))));
  });

  it('ordinal games: mixed equilibria still reported (existence), probabilities flagged not meaningful', () => {
    const f = analyse(game([[1, -1], [-1, 1]], [[-1, 1], [1, -1]], { payoffScale: 'ordinal' }));
    expect(f.matrix.equilibria.mixed).toHaveLength(1);
    expect(f.matrix.mixedProbabilitiesMeaningful).toBe(false);
  });

  it('non-2x2: no indifference facts, family not applicable', () => {
    const f = analyse(game([[1, 2, 3], [3, 2, 1]], [[1, 0, 1], [0, 1, 0]]));
    expect(f.matrix.indifference2x2).toBeNull();
    expect(f.matrix.family.applicable).toBe(false);
  });

  it('sequential2: simultaneous-version matrix plus sequential facts', () => {
    const s: Sequential2Game = { ...game([[2, -1], [0, 0]], [[1, -1], [3, 3]]), kind: 'sequential2' };
    const f = analyse(s);
    expect(f.matrixRole).toBe('simultaneous-version');
    expect(f.sequential!.followerBestResponses).toEqual([[0], [0, 1]]);
    expect(f.sequential!.comparison.firstMover).toBe('advantage');
  });

  it('repeated: stage-game matrix plus grim/unravelling facts', () => {
    const r: RepeatedGame = { kind: 'repeated', schemaVersion: 1, stage: pd, horizon: { type: 'continuation', delta: '1/3' }, monitoring: 'perfect' };
    const f = analyseExact(r);
    expect(f.matrixRole).toBe('stage-game');
    expect(f.repeated!.grimAtDelta!.sustainable).toBe(false);
    expect(f.repeated!.finiteHorizon.applies).toBe(false);
    const nonPd: RepeatedGame = { ...r, stage: game([[4, 0], [3, 2]], [[4, 3], [0, 2]]) };
    expect(analyse(nonPd).repeated!.grimAtDelta).toBeNull();
  });

  it('rejects invalid games', () => {
    expect(() => analyse({ kind: 'normal' } as never)).toThrow(/Invalid game definition/);
  });

  it('toJSONValue converts Rationals and bigints deeply and drops undefined', () => {
    expect(toJSONValue({ a: Rational.of(1, 2), b: [Rational.ONE], c: 5n, d: undefined, e: null, f: 'x' })).toEqual({
      a: '1/2',
      b: ['1'],
      c: '5',
      e: null,
      f: 'x',
    });
  });
});
