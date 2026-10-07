/**
 * Two-stage perfect-information games (kind 'sequential2'): backward induction,
 * the follower's best-response function, and comparison with the simultaneous version.
 *
 * Only pure-strategy subgame-perfect equilibria are enumerated. When the follower is
 * indifferent, mixed tie-breaking can support further SPE; those are not enumerated
 * (flagged via `followerTies`).
 */
import { compile, type Bimatrix } from './compile.js';
import { solveEquilibria, type EquilibriumSet } from './equilibria.js';
import { expectedPayoffs } from './expected.js';
import { argmaxAll, maxOf, minOf, type Rational } from './rational.js';
import type { NormalGame, Profile, Sequential2Game } from './types.js';
import { assertSequential2 } from './validate.js';

/** The simultaneous-move normal form with the same players and payoffs (for contrast). */
export function toSimultaneous(game: Sequential2Game): NormalGame {
  assertSequential2(game);
  const out: NormalGame = {
    kind: 'normal',
    schemaVersion: 1,
    players: game.players.map((p) => ({ ...p, actions: p.actions.map((a) => ({ ...a })) })),
    payoffs: game.payoffs.map((row) => row.map((cell) => [...cell])),
    payoffScale: game.payoffScale,
  };
  if (game.id !== undefined) out.id = `${game.id}:simultaneous`;
  if (game.title !== undefined) out.title = game.title;
  return out;
}

/** For each leader action, the follower's best responses (ties included). */
export function followerBestResponses(game: Sequential2Game): number[][] {
  const bm = compile(game);
  return bm.B.map((row) => argmaxAll(row));
}

export type TieBreakPolicy = 'all' | 'leader-favourable' | 'leader-unfavourable';

export interface SubgamePerfectEquilibrium {
  leaderAction: number;
  /** Follower's plan: response to every leader action (on and off the path). */
  followerPlan: number[];
  outcome: Profile;
  payoffs: [Rational, Rational];
}

export interface BackwardInductionResult {
  tieBreak: TieBreakPolicy;
  /** All pure SPE consistent with the tie-break policy. */
  spe: SubgamePerfectEquilibrium[];
  /** Distinct SPE outcomes (paths). */
  outcomes: Profile[];
  /** Leader actions after which the follower is indifferent between several best responses. */
  followerTies: { leaderAction: number; responses: number[] }[];
  /** True if some follower tie lies on an SPE path (the outcome then depends on tie-breaking). */
  onPathTie: boolean;
}

const MAX_PLANS = 100000;

function candidateResponses(bm: Bimatrix, policy: TieBreakPolicy): number[][] {
  return bm.B.map((row, a) => {
    const brs = argmaxAll(row);
    if (policy === 'all' || brs.length === 1) return brs;
    const leaderVals = brs.map((b) => bm.A[a]![b]!);
    const target = policy === 'leader-favourable' ? maxOf(leaderVals) : minOf(leaderVals);
    return brs.filter((b) => bm.A[a]![b]!.eq(target));
  });
}

export function backwardInduction(game: Sequential2Game, tieBreak: TieBreakPolicy = 'all'): BackwardInductionResult {
  const bm = compile(game);
  const brs = followerBestResponses(game);
  const cand = candidateResponses(bm, tieBreak);
  const count = cand.reduce((acc, c) => acc * c.length, 1);
  if (count > MAX_PLANS) throw new RangeError('backwardInduction: too many follower plans to enumerate');
  const plans: number[][] = [[]];
  for (const c of cand) {
    const next: number[][] = [];
    for (const p of plans) for (const b of c) next.push([...p, b]);
    plans.splice(0, plans.length, ...next);
  }
  const spe: SubgamePerfectEquilibrium[] = [];
  for (const plan of plans) {
    const leaderVals = plan.map((b, a) => bm.A[a]![b]!);
    for (const a of argmaxAll(leaderVals)) {
      const b = plan[a]!;
      spe.push({ leaderAction: a, followerPlan: plan, outcome: [a, b], payoffs: [bm.A[a]![b]!, bm.B[a]![b]!] });
    }
  }
  const seen = new Set<string>();
  const outcomes: Profile[] = [];
  for (const e of spe) {
    const k = e.outcome.join(',');
    if (!seen.has(k)) {
      seen.add(k);
      outcomes.push(e.outcome);
    }
  }
  const followerTies = brs.map((responses, leaderAction) => ({ leaderAction, responses })).filter((t) => t.responses.length > 1);
  const onPathTie = spe.some((e) => brs[e.leaderAction]!.length > 1);
  return { tieBreak, spe, outcomes, followerTies, onPathTie };
}

export type FirstMoverEffect = 'advantage' | 'disadvantage' | 'none' | 'ambiguous';

export interface SequentialComparison {
  backwardInduction: BackwardInductionResult;
  simultaneous: EquilibriumSet;
  /** Leader payoffs across SPE. */
  speLeaderPayoffs: Rational[];
  /** Leader payoffs attainable in the simultaneous game's equilibria (pure, mixed, continuum extremes). */
  simultaneousLeaderPayoffs: Rational[];
  /**
   * advantage: every SPE pays the leader at least the best simultaneous-NE payoff and more than the worst;
   * disadvantage: the mirror image; none: all equal; ambiguous: otherwise.
   */
  firstMover: FirstMoverEffect;
  /** SPE outcomes that are also pure NE of the simultaneous game. */
  speOutcomesThatAreSimultaneousNE: Profile[];
  /** Pure NE of the simultaneous game that are not SPE outcomes (e.g. supported by threats that are not credible). */
  simultaneousPureNENotSPEOutcome: Profile[];
}

export function compareWithSimultaneous(game: Sequential2Game, tieBreak: TieBreakPolicy = 'all'): SequentialComparison {
  const bi = backwardInduction(game, tieBreak);
  const sim = toSimultaneous(game);
  const eq = solveEquilibria(sim);
  const bm = compile(sim);
  const speLeaderPayoffs = bi.spe.map((e) => e.payoffs[0]);
  const simVals: Rational[] = [
    ...eq.pure.map(([i, j]) => bm.A[i]![j]!),
    ...eq.mixed.map((mp) => expectedPayoffs(sim, mp)[0]),
    ...eq.continua.flatMap((c) => c.payoffRange[0]),
  ];
  const sMin = minOf(speLeaderPayoffs);
  const sMax = maxOf(speLeaderPayoffs);
  const nMin = minOf(simVals);
  const nMax = maxOf(simVals);
  let firstMover: FirstMoverEffect = 'ambiguous';
  if (sMin.eq(sMax) && nMin.eq(nMax) && sMin.eq(nMin)) firstMover = 'none';
  else if (sMin.ge(nMax) && sMin.gt(nMin)) firstMover = 'advantage';
  else if (sMax.le(nMin) && sMax.lt(nMax)) firstMover = 'disadvantage';
  const key = (p: Profile) => p.join(',');
  const neKeys = new Set(eq.pure.map(key));
  const speKeys = new Set(bi.outcomes.map(key));
  return {
    backwardInduction: bi,
    simultaneous: eq,
    speLeaderPayoffs,
    simultaneousLeaderPayoffs: simVals,
    firstMover,
    speOutcomesThatAreSimultaneousNE: bi.outcomes.filter((p) => neKeys.has(key(p))),
    simultaneousPureNENotSPEOutcome: eq.pure.filter((p) => !speKeys.has(key(p))),
  };
}
