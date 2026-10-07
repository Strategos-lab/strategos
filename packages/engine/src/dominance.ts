/**
 * Dominance between PURE strategies, and iterated elimination.
 *
 * Scope (V1): an action is only ever compared with other pure actions.
 * TODO(V2): domination by mixed strategies (an action can be strictly dominated
 * by a mixture of two others without being dominated by any single action; that
 * needs a small exact LP). Results are therefore labelled `against: 'pure-strategies'`,
 * and "not dominated" here means "not dominated by any pure action", NOT
 * "undominated" in the general sense.
 */
import { compile, ownMatrix, assertPlayer, type Bimatrix, type MatrixGame } from './compile.js';
import type { Rational } from './rational.js';

export interface ActionDominance {
  action: number;
  /** Strictly better than every other action against every opponent action. */
  strictlyDominant: boolean;
  /** Weakly dominates every other action (>= everywhere, > somewhere, for each other action). Implied by strictlyDominant. */
  weaklyDominant: boolean;
  /** Payoff >= every other action's against every opponent action (a best response to everything). */
  alwaysBestResponse: boolean;
  /** Pure actions that strictly dominate this one (> against every opponent action). */
  strictlyDominatedBy: number[];
  /** Pure actions that weakly dominate this one (>= everywhere, > somewhere). Includes strict dominators. */
  weaklyDominatedBy: number[];
}

export interface PlayerDominance {
  player: 0 | 1;
  /** Comparison set used. V1 compares pure actions only (see module docs). */
  against: 'pure-strategies';
  actions: ActionDominance[];
  strictlyDominantAction: number | null;
  weaklyDominantAction: number | null;
}

type Rel = 'strict' | 'weak' | 'none';

/** Does row `a` dominate row `b` of U, restricted to opponent actions `opp`? */
function relation(U: Rational[][], a: number, b: number, opp: readonly number[]): Rel {
  let allGreater = true;
  let someGreater = false;
  for (const s of opp) {
    const c = U[a]![s]!.cmp(U[b]![s]!);
    if (c < 0) return 'none';
    if (c > 0) someGreater = true;
    else allGreater = false;
  }
  if (opp.length === 0) return 'none';
  if (allGreater) return 'strict';
  return someGreater ? 'weak' : 'none';
}

function dominanceOn(U: Rational[][], own: readonly number[], opp: readonly number[]): Map<number, { strict: number[]; weak: number[] }> {
  const res = new Map<number, { strict: number[]; weak: number[] }>();
  for (const b of own) {
    const strict: number[] = [];
    const weak: number[] = [];
    for (const a of own) {
      if (a === b) continue;
      const rel = relation(U, a, b, opp);
      if (rel === 'strict') {
        strict.push(a);
        weak.push(a);
      } else if (rel === 'weak') weak.push(a);
    }
    res.set(b, { strict, weak });
  }
  return res;
}

function range(k: number): number[] {
  return Array.from({ length: k }, (_, i) => i);
}

/** Pure-strategy dominance analysis for one player. */
export function dominance(game: MatrixGame, player: number): PlayerDominance {
  assertPlayer(player);
  const bm = compile(game);
  const U = ownMatrix(bm, player);
  const own = range(U.length);
  const opp = range(U[0]!.length);
  const rel = dominanceOn(U, own, opp);
  const actions: ActionDominance[] = own.map((i) => {
    const others = own.filter((j) => j !== i);
    const strictlyDominant = others.every((j) => relation(U, i, j, opp) === 'strict');
    const weaklyDominant = others.every((j) => relation(U, i, j, opp) !== 'none');
    const alwaysBestResponse = others.every((j) => opp.every((s) => U[i]![s]!.ge(U[j]![s]!)));
    const r = rel.get(i)!;
    return {
      action: i,
      strictlyDominant,
      weaklyDominant,
      alwaysBestResponse,
      strictlyDominatedBy: r.strict,
      weaklyDominatedBy: r.weak,
    };
  });
  const sd = actions.find((a) => a.strictlyDominant);
  const wd = actions.find((a) => a.weaklyDominant);
  return {
    player,
    against: 'pure-strategies',
    actions,
    strictlyDominantAction: sd ? sd.action : null,
    weaklyDominantAction: wd ? wd.action : null,
  };
}

export interface EliminationStep {
  /** 1-based round of simultaneous elimination. */
  round: number;
  player: 0 | 1;
  action: number;
  /** Surviving pure actions that dominate it at the time of elimination. */
  dominatedBy: number[];
}

export interface IteratedEliminationResult {
  kind: 'strict' | 'weak';
  against: 'pure-strategies';
  /** Surviving actions per player (ascending indices). */
  surviving: [number[], number[]];
  /** Elimination sequence (procedure: each round removes, for both players at once, every action dominated in the current reduced game). */
  steps: EliminationStep[];
  /** True if a single profile survives. */
  solved: boolean;
  /**
   * Whether different elimination orders can lead to different survivor sets.
   * Always false for strict dominance (order independence theorem for finite games).
   * For weak dominance it is determined by exhaustive search over orders.
   */
  orderDependent: boolean;
  /** Every distinct final survivor set reachable under some elimination order (any subset of dominated actions per step). Strict elimination has exactly one. */
  possibleResults: [number[], number[]][];
  /** Human-oriented caveat for consumers (authored text is chosen by content; this is a fixed engine note). */
  warning?: string;
}

function iterate(bm: Bimatrix, kind: 'strict' | 'weak'): { surviving: [number[], number[]]; steps: EliminationStep[] } {
  const U: [Rational[][], Rational[][]] = [ownMatrix(bm, 0), ownMatrix(bm, 1)];
  let alive: [number[], number[]] = [range(bm.m), range(bm.n)];
  const steps: EliminationStep[] = [];
  for (let round = 1; ; round++) {
    const removed: [Set<number>, Set<number>] = [new Set(), new Set()];
    for (const p of [0, 1] as const) {
      const rel = dominanceOn(U[p], alive[p], alive[1 - p]!);
      for (const a of alive[p]) {
        const r = rel.get(a)!;
        const by = kind === 'strict' ? r.strict : r.weak;
        if (by.length > 0) {
          removed[p].add(a);
          steps.push({ round, player: p, action: a, dominatedBy: by });
        }
      }
    }
    if (removed[0].size === 0 && removed[1].size === 0) break;
    alive = [alive[0].filter((a) => !removed[0].has(a)), alive[1].filter((a) => !removed[1].has(a))];
  }
  return { surviving: alive, steps };
}

const MAX_ORDER_SEARCH_STATES = 1 << 16;

/**
 * Exhaustive search over elimination orders. At every step ANY non-empty subset of the currently
 * dominated actions (of either player) may be removed, which covers one-at-a-time orders and
 * simultaneous removal alike (for weak dominance these can differ: removing two actions at once
 * can reach a result that no one-at-a-time order reaches). Returns every terminal survivor set.
 */
function allOrders(bm: Bimatrix, kind: 'strict' | 'weak'): { results: [number[], number[]][]; complete: boolean } {
  const U: [Rational[][], Rational[][]] = [ownMatrix(bm, 0), ownMatrix(bm, 1)];
  const seen = new Set<string>();
  const finals = new Map<string, [number[], number[]]>();
  const stack: [number[], number[]][] = [[range(bm.m), range(bm.n)]];
  let complete = true;
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const key = `${cur[0].join(',')}|${cur[1].join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > MAX_ORDER_SEARCH_STATES) {
      complete = false;
      break;
    }
    const dominated: [0 | 1, number][] = [];
    for (const p of [0, 1] as const) {
      const rel = dominanceOn(U[p], cur[p], cur[1 - p]!);
      for (const a of cur[p]) {
        const r = rel.get(a)!;
        if ((kind === 'strict' ? r.strict : r.weak).length > 0) dominated.push([p, a]);
      }
    }
    if (dominated.length === 0) {
      finals.set(key, cur);
      continue;
    }
    for (let mask = 1; mask < 1 << dominated.length; mask++) {
      const drop: [Set<number>, Set<number>] = [new Set(), new Set()];
      dominated.forEach(([p, a], k) => {
        if (mask & (1 << k)) drop[p].add(a);
      });
      stack.push([cur[0].filter((x) => !drop[0].has(x)), cur[1].filter((x) => !drop[1].has(x))]);
    }
  }
  const results = [...finals.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v);
  return { results, complete };
}

/**
 * Iterated elimination of strictly dominated strategies (IESDS), domination by
 * pure actions only. The final result is independent of elimination order.
 */
export function iesds(game: MatrixGame): IteratedEliminationResult {
  const bm = compile(game);
  const { surviving, steps } = iterate(bm, 'strict');
  return {
    kind: 'strict',
    against: 'pure-strategies',
    surviving,
    steps,
    solved: surviving[0].length === 1 && surviving[1].length === 1,
    orderDependent: false,
    possibleResults: [surviving],
  };
}

export const WEAK_DOMINANCE_WARNING =
  'Iterated elimination of weakly dominated strategies can depend on the order of elimination and can remove Nash equilibria; treat the result as order-dependent.';

/**
 * Iterated elimination of weakly dominated strategies (pure dominators only).
 * `surviving` follows the maximal simultaneous procedure; `possibleResults`
 * lists every final survivor set reachable under some order (removing any
 * subset of dominated actions at each step), and `orderDependent` is true when
 * there is more than one.
 */
export function iteratedWeakDominance(game: MatrixGame): IteratedEliminationResult & { orderSearchComplete: boolean } {
  const bm = compile(game);
  const { surviving, steps } = iterate(bm, 'weak');
  const { results, complete } = allOrders(bm, 'weak');
  return {
    kind: 'weak',
    against: 'pure-strategies',
    surviving,
    steps,
    solved: surviving[0].length === 1 && surviving[1].length === 1,
    orderDependent: !complete || results.length > 1,
    possibleResults: results,
    orderSearchComplete: complete,
    warning: WEAK_DOMINANCE_WARNING,
  };
}
