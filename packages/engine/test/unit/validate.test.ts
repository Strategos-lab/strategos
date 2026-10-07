import { describe, expect, it } from 'vitest';
import { assertValidGame, GameValidationError, makeNormalGame, validateGame, type NormalGame } from '../../src/index.js';
import { assertNormal, assertRepeated, assertSequential2 } from '../../src/validate.js';

const base = (): NormalGame => makeNormalGame([[3, 0], [5, 1]], [[3, 5], [0, 1]], { rowActions: ['a', 'b'], colActions: ['x', 'y'] });

function errorsOf(x: unknown): string[] {
  const res = validateGame(x);
  return res.ok ? [] : res.errors.map((e) => `${e.path}: ${e.message}`);
}

describe('validateGame', () => {
  it('accepts well-formed normal, sequential2 and repeated games (2x2, 2x3, 3x2, 3x3)', () => {
    expect(validateGame(base()).ok).toBe(true);
    for (const [m, n] of [[2, 3], [3, 2], [3, 3]]) {
      const A = Array.from({ length: m }, () => Array.from({ length: n }, () => '1/2'));
      expect(validateGame(makeNormalGame(A, A)).ok).toBe(true);
    }
    expect(validateGame({ ...base(), kind: 'sequential2' }).ok).toBe(true);
    expect(validateGame({ kind: 'repeated', schemaVersion: 1, stage: base(), horizon: { type: 'fixed', rounds: 3 }, monitoring: 'perfect' }).ok).toBe(true);
    expect(validateGame({ kind: 'repeated', schemaVersion: 1, stage: base(), horizon: { type: 'continuation', delta: '9/10' }, monitoring: 'perfect' }).ok).toBe(true);
  });

  it('rejects non-objects and unknown kinds', () => {
    expect(errorsOf(null)).toEqual([': game must be an object']);
    expect(errorsOf([])).toHaveLength(1);
    expect(errorsOf({ kind: 'extensive' })[0]).toMatch(/kind/);
  });

  it('reports shape, dimension and rational errors with paths', () => {
    const g = base() as unknown as Record<string, any>;
    g.payoffs[1][0][1] = '0.5';
    g.payoffs[0] = [['1', '2']];
    g.payoffScale = 'interval';
    g.schemaVersion = 2;
    const errs = errorsOf(g);
    expect(errs.some((e) => e.startsWith('payoffs[1][0][1]') && e.includes('rational string'))).toBe(true);
    expect(errs.some((e) => e.startsWith('payoffs[0]') && e.includes('expected 2 columns'))).toBe(true);
    expect(errs.some((e) => e.startsWith('payoffScale'))).toBe(true);
    expect(errs.some((e) => e.startsWith('schemaVersion'))).toBe(true);
  });

  it('rejects wrong row counts, non-array rows/cells and non-array payoffs', () => {
    const g = base() as unknown as Record<string, any>;
    g.payoffs = [g.payoffs[0]];
    expect(errorsOf(g).some((e) => e.includes('expected 2 rows'))).toBe(true);
    const h = base() as unknown as Record<string, any>;
    h.payoffs[0] = 'x';
    h.payoffs[1][0] = ['1'];
    const errs = errorsOf(h);
    expect(errs.some((e) => e.startsWith('payoffs[0]: must be an array'))).toBe(true);
    expect(errs.some((e) => e.startsWith('payoffs[1][0]'))).toBe(true);
    const k = base() as unknown as Record<string, any>;
    k.payoffs = 'no';
    expect(errorsOf(k).some((e) => e.startsWith('payoffs'))).toBe(true);
  });

  it('requires exactly two players with unique ids and unique action ids', () => {
    const g = base() as unknown as Record<string, any>;
    g.players[1].id = g.players[0].id;
    g.players[0].actions[1].id = g.players[0].actions[0].id;
    g.players[0].label = '';
    g.players[1].actions[0].label = 3;
    const errs = errorsOf(g);
    expect(errs.some((e) => e.includes('duplicate player id'))).toBe(true);
    expect(errs.some((e) => e.includes('duplicate action id'))).toBe(true);
    expect(errs.some((e) => e.startsWith('players[0].label'))).toBe(true);
    expect(errs.some((e) => e.startsWith('players[1].actions[0].label'))).toBe(true);
    const three = base() as unknown as Record<string, any>;
    three.players.push({ ...three.players[0], id: 'z' });
    expect(errorsOf(three)[0]).toMatch(/exactly 2 players/);
    const notArr = base() as unknown as Record<string, any>;
    notArr.players = {};
    expect(errorsOf(notArr)[0]).toMatch(/players: must be an array/);
  });

  it('rejects malformed players and actions', () => {
    const g = base() as unknown as Record<string, any>;
    g.players[0] = 'p';
    expect(errorsOf(g).some((e) => e.startsWith('players[0]: must be an object'))).toBe(true);
    const h = base() as unknown as Record<string, any>;
    h.players[0].actions = [];
    h.players[1].actions[0] = 'x';
    h.players[1].id = '';
    const errs = errorsOf(h);
    expect(errs.some((e) => e.includes('non-empty array'))).toBe(true);
    expect(errs.some((e) => e.startsWith('players[1].actions[0]: must be an object'))).toBe(true);
    expect(errs.some((e) => e.startsWith('players[1].id'))).toBe(true);
    const k = base() as unknown as Record<string, any>;
    k.players[0].actions[0].id = '';
    expect(errorsOf(k).some((e) => e.startsWith('players[0].actions[0].id'))).toBe(true);
  });

  it('rejects unknown fields (typo protection) and bad optional fields', () => {
    const g = { ...base(), delt: 1, id: 5, title: false } as unknown;
    const errs = errorsOf(g);
    expect(errs.some((e) => e.includes('unknown field "delt"'))).toBe(true);
    expect(errs.some((e) => e.startsWith('id'))).toBe(true);
    expect(errs.some((e) => e.startsWith('title'))).toBe(true);
  });

  it('reserved hidden-information fields must be absent or empty', () => {
    expect(validateGame({ ...base(), hiddenInformation: {} }).ok).toBe(true);
    expect(validateGame({ ...base(), hiddenInformation: { playerTypes: {}, chance: [], informationSets: [] } }).ok).toBe(true);
    const errs = errorsOf({ ...base(), hiddenInformation: { chance: [{ id: 'c', outcomes: [] }], other: 1 } });
    expect(errs.some((e) => e.includes('reserved for hidden information'))).toBe(true);
    expect(errs.some((e) => e.includes('unknown field "other"'))).toBe(true);
    expect(errorsOf({ ...base(), hiddenInformation: 3 })[0]).toMatch(/must be an object/);
  });

  it('repeated games: stage, horizon and monitoring checks', () => {
    const rep = (h: unknown, extra: Record<string, unknown> = {}) => ({ kind: 'repeated', schemaVersion: 1, stage: base(), horizon: h, monitoring: 'perfect', ...extra });
    expect(errorsOf(rep({ type: 'fixed', rounds: 0 }))[0]).toMatch(/positive integer/);
    expect(errorsOf(rep({ type: 'fixed', rounds: 2.5 }))[0]).toMatch(/positive integer/);
    expect(errorsOf(rep({ type: 'continuation', delta: '1' }))[0]).toMatch(/0 < delta < 1/);
    expect(errorsOf(rep({ type: 'continuation', delta: '0' }))[0]).toMatch(/0 < delta < 1/);
    expect(errorsOf(rep({ type: 'continuation', delta: 0.9 }))[0]).toMatch(/rational string/);
    expect(errorsOf(rep({ type: 'forever' }))[0]).toMatch(/fixed/);
    expect(errorsOf(rep('x'))[0]).toMatch(/horizon: must be an object/);
    expect(errorsOf(rep({ type: 'fixed', rounds: 2 }, { monitoring: 'imperfect' }))[0]).toMatch(/perfect/);
    expect(errorsOf(rep({ type: 'fixed', rounds: 2 }, { stage: 5 }))[0]).toMatch(/stage/);
    expect(errorsOf(rep({ type: 'fixed', rounds: 2 }, { stage: { ...base(), kind: 'sequential2' } }))[0]).toMatch(/kind "normal"/);
    const badStage = base() as unknown as Record<string, any>;
    badStage.payoffs[0][0][0] = 'x';
    expect(errorsOf(rep({ type: 'fixed', rounds: 2 }, { stage: badStage }))[0]).toMatch(/^stage\.payoffs\[0\]\[0\]\[0\]/);
  });

  it('assert helpers throw GameValidationError with all issues', () => {
    expect(() => assertValidGame({ kind: 'normal' })).toThrow(GameValidationError);
    try {
      assertValidGame({ kind: 'normal' });
    } catch (e) {
      expect((e as GameValidationError).errors.length).toBeGreaterThan(1);
      expect((e as Error).message).toMatch(/Invalid game definition/);
    }
    expect(() => assertNormal({ ...base(), kind: 'sequential2' })).toThrow(/expected a "normal"/);
    expect(() => assertSequential2(base())).toThrow(/expected a "sequential2"/);
    expect(() => assertRepeated(base())).toThrow(/expected a "repeated"/);
    expect(() => assertNormal(base())).not.toThrow();
  });
});
