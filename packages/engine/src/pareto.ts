/**
 * Pareto analysis over PURE outcomes (cells), and of equilibria against them.
 * An outcome is Pareto-dominated if another cell gives every player at least as
 * much and some player strictly more.
 */
import { compile, type MatrixGame } from './compile.js';
import { solveEquilibria, type EquilibriumSet } from './equilibria.js';
import { expectedPayoffs } from './expected.js';
import type { Rational } from './rational.js';
import type { Profile } from './types.js';

export interface OutcomePareto {
  profile: Profile;
  payoffs: [Rational, Rational];
  efficient: boolean;
  /** Cells that Pareto-dominate this one. */
  dominatedBy: Profile[];
}

export interface ParetoAnalysis {
  outcomes: OutcomePareto[];
  efficient: Profile[];
  dominated: Profile[];
  /** Per pure NE: is it Pareto-dominated by some cell? */
  pureEquilibria: { profile: Profile; paretoDominated: boolean; dominatedBy: Profile[] }[];
  /** Per isolated mixed NE: is its expected payoff vector Pareto-dominated by some cell? */
  mixedEquilibria: { payoffs: [Rational, Rational]; paretoDominated: boolean; dominatedBy: Profile[] }[];
  /**
   * Per continuum: is EVERY equilibrium in it Pareto-dominated by some cell? On a continuum each
   * player's payoff ranges independently over an interval, so this holds iff the corner
   * (max payoff 0, max payoff 1) is dominated.
   */
  continua: { bestCorner: [Rational, Rational]; allParetoDominated: boolean }[];
  /**
   * True iff every Nash equilibrium (pure, mixed and continua) is Pareto-dominated by some
   * pure outcome: the social-dilemma signature. Null if the equilibrium set is not certified complete.
   */
  everyEquilibriumParetoDominated: boolean | null;
}

function dominates(a: readonly Rational[], b: readonly Rational[]): boolean {
  let strict = false;
  for (let k = 0; k < a.length; k++) {
    const c = a[k]!.cmp(b[k]!);
    if (c < 0) return false;
    if (c > 0) strict = true;
  }
  return strict;
}

export function paretoAnalysis(game: MatrixGame, eq: EquilibriumSet = solveEquilibria(game)): ParetoAnalysis {
  const bm = compile(game);
  const cells: { profile: Profile; payoffs: [Rational, Rational] }[] = [];
  for (let i = 0; i < bm.m; i++) for (let j = 0; j < bm.n; j++) cells.push({ profile: [i, j], payoffs: [bm.A[i]![j]!, bm.B[i]![j]!] });
  const dominatorsOf = (v: readonly Rational[]): Profile[] => cells.filter((c) => dominates(c.payoffs, v)).map((c) => c.profile);
  const outcomes: OutcomePareto[] = cells.map((c) => {
    const dominatedBy = dominatorsOf(c.payoffs);
    return { ...c, efficient: dominatedBy.length === 0, dominatedBy };
  });
  const pureEquilibria = eq.pure.map((p) => {
    const dominatedBy = dominatorsOf([bm.A[p[0]]![p[1]]!, bm.B[p[0]]![p[1]]!]);
    return { profile: p, paretoDominated: dominatedBy.length > 0, dominatedBy };
  });
  const mixedEquilibria = eq.mixed.map((mp) => {
    const payoffs = expectedPayoffs(game, mp);
    const dominatedBy = dominatorsOf(payoffs);
    return { payoffs, paretoDominated: dominatedBy.length > 0, dominatedBy };
  });
  const continua = eq.continua.map((c) => {
    const bestCorner: [Rational, Rational] = [c.payoffRange[0][1], c.payoffRange[1][1]];
    return { bestCorner, allParetoDominated: dominatorsOf(bestCorner).length > 0 };
  });
  const all = [
    ...pureEquilibria.map((e) => e.paretoDominated),
    ...mixedEquilibria.map((e) => e.paretoDominated),
    ...continua.map((e) => e.allParetoDominated),
  ];
  return {
    outcomes,
    efficient: outcomes.filter((o) => o.efficient).map((o) => o.profile),
    dominated: outcomes.filter((o) => !o.efficient).map((o) => o.profile),
    pureEquilibria,
    mixedEquilibria,
    continua,
    everyEquilibriumParetoDominated: eq.complete ? all.length > 0 && all.every(Boolean) : null,
  };
}
