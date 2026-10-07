/**
 * Nash equilibria of two-player finite games, computed exactly.
 *
 * Completeness policy
 * -------------------
 * `solveEquilibria` returns the COMPLETE equilibrium set (pure, isolated mixed,
 * and continua) for every game up to MAX_EXHAUSTIVE_ACTIONS actions per player,
 * degenerate or not. Method (Avis, Rosenberg, Savani & von Stengel 2010):
 *   1. shift payoffs to be positive (a positive affine change; equilibria unchanged);
 *   2. enumerate all vertices of the best-response polytopes
 *        P = { x >= 0 : B^T x <= 1 },  Q = { y >= 0 : A y <= 1 }
 *      exactly, by solving every square system of tight constraints over Q;
 *   3. a vertex pair (x, y) != (0, 0) that is completely labelled is an extreme
 *      equilibrium (after normalising x and y to probabilities);
 *   4. the equilibrium set is the union of the "maximal Nash subsets"
 *      conv(U) x conv(V), one per maximal biclique (U, V) of the compatibility
 *      graph between extreme-equilibrium vertices.
 * A maximal Nash subset with a single point is an isolated equilibrium; larger
 * ones are reported as continua (with their vertices). A finite game always has
 * an equilibrium (Nash 1950): the engine never reports "no equilibrium". If the
 * exhaustive method cannot be run, `complete` is false and a reason is given.
 */
import { compile, ownMatrix, toDistribution, type Bimatrix, type MatrixGame } from './compile.js';
import { expectedPayoffs, type MixedProfile, type MixedProfileLike } from './expected.js';
import { affineDimension, solveLinear } from './linalg.js';
import { argmaxAll, dot, maxOf, minOf, Rational } from './rational.js';
import type { Profile } from './types.js';

/** Largest number of actions per player for which the exhaustive exact method runs. */
export const MAX_EXHAUSTIVE_ACTIONS = 6;

/** All pure Nash equilibria (cells where both actions are mutual best responses, ties included). Row-major order. */
export function pureNash(game: MatrixGame): Profile[] {
  const bm = compile(game);
  const out: Profile[] = [];
  const colMax = Array.from({ length: bm.n }, (_, j) => maxOf(bm.A.map((row) => row[j]!)));
  const rowMax = bm.B.map((row) => maxOf(row));
  for (let i = 0; i < bm.m; i++) {
    for (let j = 0; j < bm.n; j++) {
      if (bm.A[i]![j]!.eq(colMax[j]!) && bm.B[i]![j]!.eq(rowMax[i]!)) out.push([i, j]);
    }
  }
  return out;
}

export interface NashCheck {
  isNash: boolean;
  /** Expected payoffs at the profile. */
  payoffs: [Rational, Rational];
  /** Best pure-deviation payoff minus current payoff, per player (>= 0; 0 means no profitable deviation). */
  deviationGains: [Rational, Rational];
}

/** Exact equilibrium test: no player has a profitable pure deviation. */
export function checkNash(game: MatrixGame, profile: MixedProfileLike): NashCheck {
  const bm = compile(game);
  const x = toDistribution(profile[0], bm.m, 'player 0 strategy');
  const y = toDistribution(profile[1], bm.n, 'player 1 strategy');
  const payoffs = expectedPayoffs(game, [x, y]);
  const rowVals = bm.A.map((row) => dot(row, y));
  const colVals = ownMatrix(bm, 1).map((row) => dot(row, x));
  const g0 = maxOf(rowVals).sub(payoffs[0]);
  const g1 = maxOf(colVals).sub(payoffs[1]);
  return { isNash: g0.isZero() && g1.isZero(), payoffs, deviationGains: [g0, g1] };
}

export function isNashEquilibrium(game: MatrixGame, profile: MixedProfileLike): boolean {
  return checkNash(game, profile).isNash;
}

/** A maximal set of equilibria of the form conv(vertices[0]) x conv(vertices[1]) containing more than one point. */
export interface NashContinuum {
  /** Extreme points (mixed strategies) of each player's part. Every combination of convex mixtures is an equilibrium. */
  vertices: [Rational[][], Rational[][]];
  /** Affine dimension of the product set (1 = a segment). */
  dimension: number;
  shape: 'segment' | 'polytope';
  /** Each player's equilibrium payoff range over the continuum [min, max]. */
  payoffRange: [[Rational, Rational], [Rational, Rational]];
}

export interface EquilibriumSet {
  /** Every pure Nash equilibrium (including any that are endpoints of a continuum). */
  pure: Profile[];
  /** Isolated equilibria in which at least one player mixes. */
  mixed: MixedProfile[];
  /** Continua (non-singleton maximal Nash subsets). Empty in nondegenerate games. */
  continua: NashContinuum[];
  /** All extreme equilibria (vertices of the equilibrium components), pure ones included. */
  extremeEquilibria: MixedProfile[];
  /** True if the game is degenerate (some mixed strategy with support size k has more than k pure best responses). */
  degenerate: boolean;
  /** True when the listed sets are certified to be the entire equilibrium set. */
  complete: boolean;
  incompleteReason?: string;
  /** Nash (1950): every finite game has at least one equilibrium. Always true. */
  existenceGuaranteed: true;
  /** False iff there are infinitely many equilibria (a continuum exists). Null if incomplete. */
  finite: boolean | null;
  method: 'extreme-equilibrium-enumeration' | 'pure-enumeration-only';
}

interface Constraint {
  /** Coefficients over the polytope's variables. */
  coeffs: Rational[];
  /** Right-hand side (0 for non-negativity written as -x_k <= 0 -> tight when x_k = 0; 1 otherwise). */
  rhs: Rational;
  /** Is this a non-negativity constraint (x_k >= 0)? */
  nonneg: boolean;
  label: number;
}

interface Vertex {
  point: Rational[];
  labels: bigint;
  labelCount: number;
}

function* combinations(n: number, k: number): Generator<number[]> {
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k > n) return;
  for (;;) {
    yield [...idx];
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

function isTight(c: Constraint, x: Rational[]): boolean {
  return c.nonneg ? x[c.coeffs.findIndex((v) => !v.isZero())]!.isZero() : dot(c.coeffs, x).eq(c.rhs);
}

function feasible(c: Constraint, x: Rational[]): boolean {
  return c.nonneg ? x[c.coeffs.findIndex((v) => !v.isZero())]!.ge(0) : dot(c.coeffs, x).le(c.rhs);
}

function enumerateVertices(dim: number, cons: Constraint[]): Vertex[] {
  const seen = new Map<string, Vertex>();
  for (const subset of combinations(cons.length, dim)) {
    const M = subset.map((k) => cons[k]!.coeffs);
    const b = subset.map((k) => cons[k]!.rhs);
    const x = solveLinear(M, b);
    if (!x) continue;
    if (!cons.every((c) => feasible(c, x))) continue;
    const key = x.join(',');
    if (seen.has(key)) continue;
    let labels = 0n;
    let labelCount = 0;
    for (const c of cons) {
      if (isTight(c, x)) {
        labels |= 1n << BigInt(c.label);
        labelCount++;
      }
    }
    seen.set(key, { point: x, labels, labelCount });
  }
  return [...seen.values()];
}

function shiftPositive(M: Rational[][]): Rational[][] {
  const lo = minOf(M.flat());
  const c = lo.lt(1) ? Rational.ONE.sub(lo) : Rational.ZERO;
  return M.map((row) => row.map((v) => v.add(c)));
}

function normalise(v: Rational[]): Rational[] {
  const s = v.reduce((a, b) => a.add(b), Rational.ZERO);
  return v.map((x) => x.div(s));
}

function isPureVec(v: Rational[]): boolean {
  return v.filter((x) => !x.isZero()).length === 1;
}

function unit(k: number, i: number): Rational[] {
  return Array.from({ length: k }, (_, t) => (t === i ? Rational.ONE : Rational.ZERO));
}

interface VertexAnalysis {
  xs: Vertex[];
  ys: Vertex[];
  degenerate: boolean;
}

function polytopeVertices(bm: Bimatrix): VertexAnalysis {
  const { m, n } = bm;
  const A = shiftPositive(bm.A);
  const B = shiftPositive(bm.B);
  // P = { x in R^m : x >= 0 (labels 0..m-1), B^T x <= 1 (labels m..m+n-1) }
  const pCons: Constraint[] = [];
  for (let i = 0; i < m; i++) pCons.push({ coeffs: unit(m, i), rhs: Rational.ZERO, nonneg: true, label: i });
  for (let j = 0; j < n; j++) {
    pCons.push({ coeffs: Array.from({ length: m }, (_, i) => B[i]![j]!), rhs: Rational.ONE, nonneg: false, label: m + j });
  }
  // Q = { y in R^n : A y <= 1 (labels 0..m-1), y >= 0 (labels m..m+n-1) }
  const qCons: Constraint[] = [];
  for (let i = 0; i < m; i++) qCons.push({ coeffs: [...A[i]!], rhs: Rational.ONE, nonneg: false, label: i });
  for (let j = 0; j < n; j++) qCons.push({ coeffs: unit(n, j), rhs: Rational.ZERO, nonneg: true, label: m + j });
  const xs = enumerateVertices(m, pCons);
  const ys = enumerateVertices(n, qCons);
  const degenerate = xs.some((v) => v.labelCount > m) || ys.some((v) => v.labelCount > n);
  return { xs, ys, degenerate };
}

/**
 * Whether the game is degenerate: some mixed strategy with support size k has
 * more than k pure best responses (von Stengel). Ties between pure best responses
 * are the commonest cause. Degenerate games may have continua of equilibria.
 */
export function isDegenerate(game: MatrixGame): boolean {
  return polytopeVertices(compile(game)).degenerate;
}

function payoffRange(bm: Bimatrix, U: Rational[][], V: Rational[][]): [[Rational, Rational], [Rational, Rational]] {
  // On a Nash subset conv(U) x conv(V), player 0's payoff depends only on y (all u in U are best
  // responses to every y in conv(V)) and is linear in y; similarly player 1's depends only on x.
  // So the payoff ranges are attained at vertices.
  const u0 = V.map((y) => dot(bm.A.map((row) => dot(row, y)), U[0]!));
  const colVals = (x: Rational[]) => ownMatrix(bm, 1).map((row) => dot(row, x));
  const u1 = U.map((x) => dot(colVals(x), V[0]!));
  return [
    [minOf(u0), maxOf(u0)],
    [minOf(u1), maxOf(u1)],
  ];
}

/** The complete Nash equilibrium set (see module documentation for the guarantees). */
export function solveEquilibria(game: MatrixGame): EquilibriumSet {
  const bm = compile(game);
  const pure = pureNash(game);
  if (bm.m > MAX_EXHAUSTIVE_ACTIONS || bm.n > MAX_EXHAUSTIVE_ACTIONS) {
    return {
      pure,
      mixed: [],
      continua: [],
      extremeEquilibria: pure.map(([i, j]) => [unit(bm.m, i), unit(bm.n, j)]),
      degenerate: false,
      complete: false,
      incompleteReason: `exhaustive exact enumeration is limited to ${MAX_EXHAUSTIVE_ACTIONS} actions per player; only pure equilibria were enumerated. At least one (possibly mixed) equilibrium exists by Nash's theorem.`,
      existenceGuaranteed: true,
      finite: null,
      method: 'pure-enumeration-only',
    };
  }
  const { xs, ys, degenerate } = polytopeVertices(bm);
  const full = (1n << BigInt(bm.m + bm.n)) - 1n;
  const xNon = xs.filter((v) => v.point.some((t) => !t.isZero()));
  const yNon = ys.filter((v) => v.point.some((t) => !t.isZero()));
  // Compatibility graph between nonzero vertices.
  const adj: bigint[] = xNon.map((xv) => {
    let mask = 0n;
    yNon.forEach((yv, k) => {
      if ((xv.labels | yv.labels) === full) mask |= 1n << BigInt(k);
    });
    return mask;
  });
  // Extreme equilibria.
  const extreme: MixedProfile[] = [];
  xNon.forEach((xv, a) => {
    yNon.forEach((yv, k) => {
      if ((adj[a]! >> BigInt(k)) & 1n) extreme.push([normalise(xv.point), normalise(yv.point)]);
    });
  });
  // Maximal bicliques: closed sets of Y-vertices are intersections of neighbourhoods.
  const family = new Set<bigint>();
  for (const nb of adj) if (nb !== 0n) family.add(nb);
  let changed = true;
  while (changed) {
    changed = false;
    const cur = [...family];
    for (let s = 0; s < cur.length; s++) {
      for (let t = s + 1; t < cur.length; t++) {
        const inter = cur[s]! & cur[t]!;
        if (inter !== 0n && !family.has(inter)) {
          family.add(inter);
          changed = true;
        }
      }
    }
  }
  const mixed: MixedProfile[] = [];
  const continua: NashContinuum[] = [];
  const sortedFamily = [...family].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const V of sortedFamily) {
    const Uidx = xNon.map((_, a) => a).filter((a) => (adj[a]! & V) === V);
    const Vidx = yNon.map((_, k) => k).filter((k) => (V >> BigInt(k)) & 1n);
    const U = Uidx.map((a) => normalise(xNon[a]!.point));
    const W = Vidx.map((k) => normalise(yNon[k]!.point));
    if (U.length === 1 && W.length === 1) {
      if (!(isPureVec(U[0]!) && isPureVec(W[0]!))) mixed.push([U[0]!, W[0]!]);
    } else {
      const dimension = affineDimension(U) + affineDimension(W);
      continua.push({
        vertices: [U, W],
        dimension,
        shape: dimension === 1 ? 'segment' : 'polytope',
        payoffRange: payoffRange(bm, U, W),
      });
    }
  }
  if (extreme.length === 0) {
    // Mathematically impossible for a finite game (Nash 1950). Fail loudly rather than lie.
    throw new Error('internal error: no equilibrium found; this contradicts Nash\'s theorem — please report');
  }
  return {
    pure,
    mixed,
    continua,
    extremeEquilibria: extreme,
    degenerate,
    complete: true,
    existenceGuaranteed: true,
    finite: continua.length === 0,
    method: 'extreme-equilibrium-enumeration',
  };
}

export interface SupportEnumerationResult {
  equilibria: MixedProfile[];
  /**
   * Support enumeration over equal-size supports finds every equilibrium of a
   * NONDEGENERATE game. For degenerate games it may miss equilibria (and cannot
   * describe continua), so its output is then not certified complete.
   */
  degenerate: boolean;
  complete: boolean;
}

/**
 * Classic support enumeration with exact rationals (equal-size supports). Kept as an
 * independent cross-check of `solveEquilibria` on nondegenerate games.
 */
export function supportEnumeration(game: MatrixGame): SupportEnumerationResult {
  const bm = compile(game);
  const { m, n, A } = bm;
  const Bt = ownMatrix(bm, 1);
  const found = new Map<string, MixedProfile>();
  const solveSide = (U: Rational[][], I: number[], J: number[], k: number): Rational[] | null => {
    // unknowns: q_j (j in J), v. Equations: sum_j U[i][j] q_j - v = 0 (i in I), sum q_j = 1.
    const M: Rational[][] = I.map((i) => [...J.map((j) => U[i]![j]!), Rational.ONE.neg()]);
    M.push([...J.map(() => Rational.ONE), Rational.ZERO]);
    const b = [...I.map(() => Rational.ZERO), Rational.ONE];
    const sol = solveLinear(M, b);
    if (!sol) return null;
    const q = sol.slice(0, J.length);
    if (q.some((t) => t.lt(0))) return null;
    const full = Array.from({ length: k }, () => Rational.ZERO);
    J.forEach((j, t) => (full[j] = q[t]!));
    return full;
  };
  for (let size = 1; size <= (m < n ? m : n); size++) {
    for (const I of combinations(m, size)) {
      for (const J of combinations(n, size)) {
        const y = solveSide(A, I, J, n);
        if (!y) continue;
        const x = solveSide(Bt, J, I, m);
        if (!x) continue;
        if (!checkNash(game, [x, y]).isNash) continue;
        found.set(`${x.join(',')}|${y.join(',')}`, [x, y]);
      }
    }
  }
  const degenerate = isDegenerate(game);
  return { equilibria: [...found.values()], degenerate, complete: !degenerate };
}

export type IndifferenceSolution =
  | { kind: 'unique'; p: Rational; inUnitInterval: boolean; interior: boolean }
  | { kind: 'always' }
  | { kind: 'never' };

export interface Indifference2x2 {
  /**
   * [0]: probability player 0 must put on its action 0 to make player 1 indifferent;
   * [1]: probability player 1 must put on its action 0 to make player 0 indifferent.
   */
  indifferenceMix: [IndifferenceSolution, IndifferenceSolution];
  /** The fully mixed equilibrium given by the indifference method, when both mixes are interior. */
  fullyMixed: MixedProfile | null;
}

function indifferenceFor(U: Rational[][]): IndifferenceSolution {
  // U[own][opp] of the player to be made indifferent; the opponent mixes p on its action 0.
  // own action 0 vs 1: p*U[0][0] + (1-p)*U[0][1] = p*U[1][0] + (1-p)*U[1][1]
  const a = U[0]![0]!.sub(U[1]![0]!);
  const b = U[0]![1]!.sub(U[1]![1]!);
  const denom = a.sub(b);
  if (denom.isZero()) return b.isZero() ? { kind: 'always' } : { kind: 'never' };
  const p = b.neg().div(denom);
  return { kind: 'unique', p, inUnitInterval: p.ge(0) && p.le(1), interior: p.gt(0) && p.lt(1) };
}

/** The indifference method for 2x2 games (pedagogical facts; `solveEquilibria` is authoritative). */
export function indifference2x2(game: MatrixGame): Indifference2x2 {
  const bm = compile(game);
  if (bm.m !== 2 || bm.n !== 2) throw new RangeError('indifference2x2 requires a 2x2 game');
  const s0 = indifferenceFor(ownMatrix(bm, 1)); // player 0 mixes to make player 1 indifferent
  const s1 = indifferenceFor(ownMatrix(bm, 0));
  let fullyMixed: MixedProfile | null = null;
  if (s0.kind === 'unique' && s0.interior && s1.kind === 'unique' && s1.interior) {
    fullyMixed = [
      [s0.p, Rational.ONE.sub(s0.p)],
      [s1.p, Rational.ONE.sub(s1.p)],
    ];
  }
  return { indifferenceMix: [s0, s1], fullyMixed };
}

/** Indices of best responses of each player to a mixed profile (helper for consumers). */
export function supportBestResponses(game: MatrixGame, profile: MixedProfileLike): [number[], number[]] {
  const bm = compile(game);
  const x = toDistribution(profile[0], bm.m);
  const y = toDistribution(profile[1], bm.n);
  return [argmaxAll(bm.A.map((row) => dot(row, y))), argmaxAll(ownMatrix(bm, 1).map((row) => dot(row, x)))];
}
