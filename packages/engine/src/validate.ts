/** Structural validation of game definitions, with path-addressed error messages. */
import { Rational } from './rational.js';
import { SCHEMA_VERSION, type GameDefinition, type NormalGame, type RepeatedGame, type Sequential2Game } from './types.js';

export interface ValidationIssue {
  /** JSON-path-like location, e.g. "payoffs[1][0][1]". */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; game: GameDefinition }
  | { ok: false; errors: ValidationIssue[] };

export class GameValidationError extends Error {
  readonly errors: ValidationIssue[];
  constructor(errors: ValidationIssue[]) {
    super(`Invalid game definition:\n${errors.map((e) => `  ${e.path || '(root)'}: ${e.message}`).join('\n')}`);
    this.name = 'GameValidationError';
    this.errors = errors;
  }
}

/** Number of players supported in schemaVersion 1. */
export const V1_PLAYER_COUNT = 2;

type Obj = Record<string, unknown>;

function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function checkKeys(o: Obj, allowed: readonly string[], path: string, errs: ValidationIssue[]): void {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) errs.push({ path: join(path, k), message: `unknown field "${k}"` });
  }
}

function join(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

const NORMAL_KEYS = ['kind', 'schemaVersion', 'id', 'title', 'players', 'payoffs', 'payoffScale', 'hiddenInformation'] as const;
const REPEATED_KEYS = ['kind', 'schemaVersion', 'id', 'title', 'stage', 'horizon', 'monitoring', 'hiddenInformation'] as const;

function checkCommon(o: Obj, path: string, errs: ValidationIssue[]): void {
  if (o.schemaVersion !== SCHEMA_VERSION) {
    errs.push({ path: join(path, 'schemaVersion'), message: `must be ${SCHEMA_VERSION}` });
  }
  if (o.id !== undefined && typeof o.id !== 'string') errs.push({ path: join(path, 'id'), message: 'must be a string' });
  if (o.title !== undefined && typeof o.title !== 'string') {
    errs.push({ path: join(path, 'title'), message: 'must be a string' });
  }
  const h = o.hiddenInformation;
  if (h !== undefined) {
    const p = join(path, 'hiddenInformation');
    if (!isObj(h)) {
      errs.push({ path: p, message: 'must be an object' });
    } else {
      checkKeys(h, ['playerTypes', 'chance', 'informationSets'], p, errs);
      for (const [k, v] of Object.entries(h)) {
        const empty = v === undefined || (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0);
        if (!empty) {
          errs.push({
            path: join(p, k),
            message: 'reserved for hidden information; not supported in schemaVersion 1 (must be absent or empty)',
          });
        }
      }
    }
  }
}

function checkPlayers(o: Obj, path: string, errs: ValidationIssue[]): number[] | null {
  const players = o.players;
  const p = join(path, 'players');
  if (!Array.isArray(players)) {
    errs.push({ path: p, message: 'must be an array' });
    return null;
  }
  if (players.length !== V1_PLAYER_COUNT) {
    errs.push({ path: p, message: `schemaVersion 1 supports exactly ${V1_PLAYER_COUNT} players (got ${players.length})` });
    return null;
  }
  const sizes: number[] = [];
  const ids = new Set<string>();
  let ok = true;
  players.forEach((pl, i) => {
    const pp = join(p, i);
    if (!isObj(pl)) {
      errs.push({ path: pp, message: 'must be an object' });
      ok = false;
      return;
    }
    checkKeys(pl, ['id', 'label', 'actions'], pp, errs);
    if (!isNonEmptyString(pl.id)) errs.push({ path: join(pp, 'id'), message: 'must be a non-empty string' });
    else if (ids.has(pl.id)) errs.push({ path: join(pp, 'id'), message: `duplicate player id "${pl.id}"` });
    else ids.add(pl.id);
    if (!isNonEmptyString(pl.label)) errs.push({ path: join(pp, 'label'), message: 'must be a non-empty string' });
    const acts = pl.actions;
    const ap = join(pp, 'actions');
    if (!Array.isArray(acts) || acts.length === 0) {
      errs.push({ path: ap, message: 'must be a non-empty array' });
      ok = false;
      return;
    }
    const aids = new Set<string>();
    acts.forEach((a, k) => {
      const aap = join(ap, k);
      if (!isObj(a)) {
        errs.push({ path: aap, message: 'must be an object' });
        return;
      }
      checkKeys(a, ['id', 'label'], aap, errs);
      if (!isNonEmptyString(a.id)) errs.push({ path: join(aap, 'id'), message: 'must be a non-empty string' });
      else if (aids.has(a.id)) errs.push({ path: join(aap, 'id'), message: `duplicate action id "${a.id}"` });
      else aids.add(a.id);
      if (!isNonEmptyString(a.label)) errs.push({ path: join(aap, 'label'), message: 'must be a non-empty string' });
    });
    sizes.push(acts.length);
  });
  return ok ? sizes : null;
}

function checkPayoffs(o: Obj, sizes: number[] | null, path: string, errs: ValidationIssue[]): void {
  const pay = o.payoffs;
  const p = join(path, 'payoffs');
  if (!Array.isArray(pay)) {
    errs.push({ path: p, message: 'must be an array (rows = player 0 actions)' });
    return;
  }
  if (!sizes) return;
  const [m, n] = sizes as [number, number];
  if (pay.length !== m) errs.push({ path: p, message: `expected ${m} rows (one per action of player 0), got ${pay.length}` });
  pay.forEach((row, i) => {
    const rp = join(p, i);
    if (!Array.isArray(row)) {
      errs.push({ path: rp, message: 'must be an array' });
      return;
    }
    if (row.length !== n) errs.push({ path: rp, message: `expected ${n} columns (one per action of player 1), got ${row.length}` });
    row.forEach((cell, j) => {
      const cp = join(rp, j);
      if (!Array.isArray(cell) || cell.length !== V1_PLAYER_COUNT) {
        errs.push({ path: cp, message: `must be an array of ${V1_PLAYER_COUNT} payoffs (one per player)` });
        return;
      }
      cell.forEach((v, k) => {
        if (!Rational.isRationalString(v)) {
          errs.push({
            path: join(cp, k),
            message: `must be a rational string like "3" or "-1/2" (got ${JSON.stringify(v)})`,
          });
        }
      });
    });
  });
}

function validateMatrixGame(o: Obj, path: string, errs: ValidationIssue[]): void {
  checkKeys(o, NORMAL_KEYS, path, errs);
  checkCommon(o, path, errs);
  const sizes = checkPlayers(o, path, errs);
  checkPayoffs(o, sizes, path, errs);
  if (o.payoffScale !== 'ordinal' && o.payoffScale !== 'cardinal') {
    errs.push({ path: join(path, 'payoffScale'), message: 'must be "ordinal" or "cardinal"' });
  }
}

function validateRepeated(o: Obj, path: string, errs: ValidationIssue[]): void {
  checkKeys(o, REPEATED_KEYS, path, errs);
  checkCommon(o, path, errs);
  const stage = o.stage;
  const sp = join(path, 'stage');
  if (!isObj(stage)) errs.push({ path: sp, message: 'must be a normal-form game object' });
  else if (stage.kind !== 'normal') errs.push({ path: join(sp, 'kind'), message: 'stage game must have kind "normal"' });
  else validateMatrixGame(stage, sp, errs);
  const h = o.horizon;
  const hp = join(path, 'horizon');
  if (!isObj(h)) {
    errs.push({ path: hp, message: 'must be an object' });
  } else if (h.type === 'fixed') {
    checkKeys(h, ['type', 'rounds'], hp, errs);
    if (typeof h.rounds !== 'number' || !Number.isSafeInteger(h.rounds) || h.rounds < 1) {
      errs.push({ path: join(hp, 'rounds'), message: 'must be a positive integer' });
    }
  } else if (h.type === 'continuation') {
    checkKeys(h, ['type', 'delta'], hp, errs);
    if (!Rational.isRationalString(h.delta)) {
      errs.push({ path: join(hp, 'delta'), message: 'must be a rational string like "9/10"' });
    } else {
      const d = Rational.parse(h.delta);
      if (!(d.gt(0) && d.lt(1))) errs.push({ path: join(hp, 'delta'), message: 'must satisfy 0 < delta < 1' });
    }
  } else {
    errs.push({ path: join(hp, 'type'), message: 'must be "fixed" or "continuation"' });
  }
  if (o.monitoring !== 'perfect') {
    errs.push({ path: join(path, 'monitoring'), message: 'only "perfect" monitoring is supported in schemaVersion 1' });
  }
}

/** Validate an unknown value as a GameDefinition. Never throws. */
export function validateGame(x: unknown): ValidationResult {
  const errs: ValidationIssue[] = [];
  if (!isObj(x)) return { ok: false, errors: [{ path: '', message: 'game must be an object' }] };
  switch (x.kind) {
    case 'normal':
    case 'sequential2':
      validateMatrixGame(x, '', errs);
      break;
    case 'repeated':
      validateRepeated(x, '', errs);
      break;
    default:
      errs.push({ path: 'kind', message: 'must be "normal", "sequential2" or "repeated"' });
  }
  return errs.length === 0 ? { ok: true, game: x as unknown as GameDefinition } : { ok: false, errors: errs };
}

/** Validate and throw a GameValidationError listing every problem. */
export function assertValidGame(x: unknown): asserts x is GameDefinition {
  const res = validateGame(x);
  if (!res.ok) throw new GameValidationError(res.errors);
}

export function assertNormal(x: unknown): asserts x is NormalGame {
  assertValidGame(x);
  if (x.kind !== 'normal') throw new GameValidationError([{ path: 'kind', message: 'expected a "normal" game' }]);
}

export function assertSequential2(x: unknown): asserts x is Sequential2Game {
  assertValidGame(x);
  if (x.kind !== 'sequential2') {
    throw new GameValidationError([{ path: 'kind', message: 'expected a "sequential2" game' }]);
  }
}

export function assertRepeated(x: unknown): asserts x is RepeatedGame {
  assertValidGame(x);
  if (x.kind !== 'repeated') throw new GameValidationError([{ path: 'kind', message: 'expected a "repeated" game' }]);
}
