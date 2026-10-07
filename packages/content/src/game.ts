import {
  classifyFamily,
  dominance,
  bestResponses,
  iesds,
  makeNormalGame,
  type NormalGame,
} from '@strategos/engine';
import type { Seat, Structure, StructuralFacts, Who } from './types.ts';

export type Params = Record<string, number>;

const INT = /^-?\d+$/;

export function evalExpr(expr: string, params: Params): number {
  const e = expr.trim();
  if (INT.test(e)) return Number(e);
  const v = params[e];
  if (v === undefined) throw new Error(`unknown parameter "${e}"`);
  return v;
}

/** Constraint grammar: `<expr> (>|>=|<|<=|=|!=) <expr>`, expr = integer or parameter name. */
export function checkConstraint(c: string, params: Params): boolean {
  const m = /^\s*([\w-]+)\s*(>=|<=|!=|>|<|=)\s*([\w-]+)\s*$/.exec(c);
  if (!m) throw new Error(`malformed constraint "${c}"`);
  const a = evalExpr(m[1]!, params);
  const b = evalExpr(m[3]!, params);
  switch (m[2]) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '=': return a === b;
    default: return a !== b;
  }
}

/** Every parameter assignment allowed by the ranges and constraints (deterministic order). */
export function paramCombos(s: Structure): Params[] {
  const names = Object.keys(s.params).sort();
  let combos: Params[] = [{}];
  for (const n of names) {
    const next: Params[] = [];
    for (const c of combos) for (const v of s.params[n]!) next.push({ ...c, [n]: v });
    combos = next;
  }
  return combos.filter((c) => s.constraints.every((k) => checkConstraint(k, c)));
}

/** Engine game with structure player A as row player (index 0). */
export function buildGame(s: Structure, params: Params): NormalGame {
  const A: number[][] = [];
  const B: number[][] = [];
  for (const a of s.actions.A) {
    const ra: number[] = [];
    const rb: number[] = [];
    for (const b of s.actions.B) {
      const cell = s.payoffs[`${a}|${b}`];
      if (!cell) throw new Error(`${s.id}: missing payoff cell ${a}|${b}`);
      ra.push(evalExpr(cell[0], params));
      rb.push(evalExpr(cell[1], params));
    }
    A.push(ra);
    B.push(rb);
  }
  return makeNormalGame(A, B, {
    rowActions: [...s.actions.A],
    colActions: [...s.actions.B],
    players: ['A', 'B'],
    payoffScale: s.scale,
    id: s.id,
    title: s.id,
  });
}

export function playerIndex(seat: Seat, who: Who): 0 | 1 {
  const learner = seat === 'A' ? 0 : 1;
  return (who === 'you' ? learner : 1 - learner) as 0 | 1;
}

export function actionIds(s: Structure, p: 0 | 1): string[] {
  return p === 0 ? s.actions.A : s.actions.B;
}

export function payoffOf(s: Structure, params: Params, p: 0 | 1, profile: [string, string]): number {
  const cell = s.payoffs[`${profile[0]}|${profile[1]}`];
  if (!cell) throw new Error(`${s.id}: no cell ${profile.join('|')}`);
  return evalExpr(cell[p], params);
}

/** Unique best response of player p to the other's action id, or null on a tie. */
export function uniqueBestResponse(s: Structure, game: NormalGame, p: 0 | 1, against: string): string | null {
  const opp = actionIds(s, (1 - p) as 0 | 1).indexOf(against);
  if (opp < 0) throw new Error(`${s.id}: "${against}" is not an action of player ${1 - p}`);
  const br = bestResponses(game, p, opp);
  return br.length === 1 ? actionIds(s, p)[br[0]!]! : null;
}

/** Structural facts computed by the engine (never authored by hand at runtime). */
export function computeFacts(s: Structure, game: NormalGame): StructuralFacts {
  const d = [dominance(game, 0), dominance(game, 1)] as const;
  const ids = (p: 0 | 1) => actionIds(s, p);
  const strict = (p: 0 | 1) => (d[p].strictlyDominantAction === null ? null : ids(p)[d[p].strictlyDominantAction]!);
  const weakOnly = (p: 0 | 1) =>
    d[p].strictlyDominantAction === null && d[p].weaklyDominantAction !== null ? ids(p)[d[p].weaklyDominantAction]! : null;
  const dominated = (p: 0 | 1) => d[p].actions.filter((a) => a.strictlyDominatedBy.length > 0).map((a) => ids(p)[a.action]!);
  const depends = (p: 0 | 1) => {
    const sets = ids((1 - p) as 0 | 1).map((_, j) => bestResponses(game, p, j).join(','));
    return new Set(sets).size > 1;
  };
  const el = iesds(game);
  return {
    strictlyDominant: { A: strict(0), B: strict(1) },
    weaklyDominantOnly: { A: weakOnly(0), B: weakOnly(1) },
    strictlyDominated: { A: dominated(0), B: dominated(1) },
    bestResponseDependsOnOpponent: { A: depends(0), B: depends(1) },
    iesdsSolution: el.solved ? [ids(0)[el.surviving[0][0]!]!, ids(1)[el.surviving[1][0]!]!] : null,
  };
}

export function factsDiff(declared: StructuralFacts, actual: StructuralFacts): string[] {
  const out: string[] = [];
  const keys = Object.keys(actual) as (keyof StructuralFacts)[];
  for (const k of keys) {
    if (JSON.stringify(declared[k]) !== JSON.stringify(actual[k])) {
      out.push(`${k}: declared ${JSON.stringify(declared[k])}, engine ${JSON.stringify(actual[k])}`);
    }
  }
  return out;
}

/** The engine's 2×2 family label, computed on demand (never persisted in content data). */
export function structureFamily(s: Structure, params: Params = paramCombos(s)[0] ?? {}): string {
  return classifyFamily(buildGame(s, params)).family;
}
