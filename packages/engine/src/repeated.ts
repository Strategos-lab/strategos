/**
 * Repeated games: opponent strategies as finite automata, reproducible simulation,
 * exact expected totals, grim-trigger threshold, finite-horizon unravelling.
 *
 * Interpretation notes (also in the README):
 *  - Folk theorem: with a high enough continuation probability, MANY outcomes (including
 *    mutual cooperation AND mutual defection) are equilibrium outcomes. Repetition makes
 *    cooperation possible, not predicted.
 *  - Known finite horizon: if the stage game has a unique Nash equilibrium (e.g. the PD),
 *    backward induction unravels cooperation: the unique subgame-perfect equilibrium plays
 *    the stage equilibrium in every round (`finiteHorizonUnravelling`).
 *  - Tit-for-Tat and the other behavioural automata are labelled as tournament strategies,
 *    not equilibrium concepts. Grim Trigger's equilibrium role is a property of the profile
 *    (Grim, Grim) and delta, documented in `grimTriggerThreshold`.
 */
import { classifyFamily } from './classify.js';
import { compile } from './compile.js';
import { solveEquilibria } from './equilibria.js';
import type { MixedProfile } from './expected.js';
import { solveLinear } from './linalg.js';
import { Rational, type RationalLike, type RationalString } from './rational.js';
import { deriveSeed, nextBernoulli, seedRng, type RngState } from './rng.js';
import { initialState, step, type RepeatedEndReason, type RepeatedState } from './state.js';
import type { Discipline, Horizon, NormalGame, Profile, RepeatedGame } from './types.js';
import { assertRepeated } from './validate.js';

export type RoleAction = 'C' | 'D';

export interface AutomatonState {
  /** Action played in this state: a role, or a probability of playing C. */
  play: RoleAction | { cooperateProbability: RationalString };
  /** Next state given the OTHER player's realised role action this round. */
  next: { C: string; D: string };
}

/** A repeated-game strategy as a (possibly stochastic) Moore machine over C/D roles. */
export interface RepeatedStrategy {
  id: string;
  name: string;
  discipline: Discipline;
  /** Fixed engine note on the strategy's formal status. */
  disciplineNote: string;
  initial: string;
  states: Record<string, AutomatonState>;
}

export const BEHAVIOURAL_STRATEGY_NOTE = 'behavioural strategy (Axelrod tournaments); not an equilibrium concept';
export const GRIM_TRIGGER_NOTE =
  "repeated-game strategy; the profile (Grim Trigger, Grim Trigger) is a subgame-perfect equilibrium of the indefinitely repeated Prisoner's Dilemma iff delta >= (T - R) / (T - P); see grimTriggerThreshold";

const behavioural = (id: string, name: string, initial: string, states: Record<string, AutomatonState>): RepeatedStrategy => ({
  id,
  name,
  discipline: 'COMPUTATIONAL',
  disciplineNote: BEHAVIOURAL_STRATEGY_NOTE,
  initial,
  states,
});

export const ALL_C = behavioural('ALLC', 'Always Cooperate', 'c', { c: { play: 'C', next: { C: 'c', D: 'c' } } });
export const ALL_D = behavioural('ALLD', 'Always Defect', 'd', { d: { play: 'D', next: { C: 'd', D: 'd' } } });
export const TIT_FOR_TAT = behavioural('TFT', 'Tit-for-Tat', 'c', {
  c: { play: 'C', next: { C: 'c', D: 'd' } },
  d: { play: 'D', next: { C: 'c', D: 'd' } },
});
export const TIT_FOR_TWO_TATS = behavioural('TF2T', 'Tit-for-Two-Tats', 'c0', {
  c0: { play: 'C', next: { C: 'c0', D: 'c1' } },
  c1: { play: 'C', next: { C: 'c0', D: 'd' } },
  d: { play: 'D', next: { C: 'c0', D: 'd' } },
});
/** Win-Stay, Lose-Shift (Pavlov): repeat after R or T, switch after S or P. Own action is the state. */
export const WIN_STAY_LOSE_SHIFT = behavioural('WSLS', 'Win-Stay, Lose-Shift (Pavlov)', 'c', {
  c: { play: 'C', next: { C: 'c', D: 'd' } },
  d: { play: 'D', next: { C: 'd', D: 'c' } },
});
export const GRIM_TRIGGER: RepeatedStrategy = {
  id: 'GRIM',
  name: 'Grim Trigger',
  discipline: 'GT',
  disciplineNote: GRIM_TRIGGER_NOTE,
  initial: 'c',
  states: {
    c: { play: 'C', next: { C: 'c', D: 'd' } },
    d: { play: 'D', next: { C: 'd', D: 'd' } },
  },
};

/** Random(p): cooperates with probability p each round, independently (seeded). */
export function randomStrategy(p: RationalLike): RepeatedStrategy {
  const q = Rational.from(p);
  if (q.lt(0) || q.gt(1)) throw new RangeError('randomStrategy: p must lie in [0, 1]');
  return behavioural(`RANDOM(${q})`, `Random (${q})`, 'r', {
    r: { play: { cooperateProbability: q.toString() }, next: { C: 'r', D: 'r' } },
  });
}

export const STANDARD_STRATEGIES: readonly RepeatedStrategy[] = [
  ALL_C,
  ALL_D,
  TIT_FOR_TAT,
  GRIM_TRIGGER,
  TIT_FOR_TWO_TATS,
  WIN_STAY_LOSE_SHIFT,
];

/** Which stage-game action plays the C and D role, per player. */
export interface ActionRoles {
  C: number;
  D: number;
}

function validateStrategy(s: RepeatedStrategy): void {
  if (!(s.initial in s.states)) throw new RangeError(`strategy ${s.id}: unknown initial state "${s.initial}"`);
  for (const [name, st] of Object.entries(s.states)) {
    for (const k of ['C', 'D'] as const) {
      if (!(st.next[k] in s.states)) throw new RangeError(`strategy ${s.id}: state "${name}" has unknown next state "${st.next[k]}"`);
    }
    if (typeof st.play === 'object') {
      const p = Rational.parse(st.play.cooperateProbability);
      if (p.lt(0) || p.gt(1)) throw new RangeError(`strategy ${s.id}: probability out of [0, 1]`);
    }
  }
}

function coopProbability(st: AutomatonState): Rational {
  if (st.play === 'C') return Rational.ONE;
  if (st.play === 'D') return Rational.ZERO;
  return Rational.parse(st.play.cooperateProbability);
}

/** Default C/D roles: the PD roles found by the classifier, otherwise action 0 = C, action 1 = D. */
export function defaultRoles(stage: NormalGame): [ActionRoles, ActionRoles] {
  const bm = compile(stage);
  if (bm.m !== 2 || bm.n !== 2) throw new RangeError('automaton strategies require a 2x2 stage game');
  const fam = classifyFamily(stage);
  if (fam.roles) {
    return [
      { C: fam.roles.cooperate[0], D: fam.roles.defect[0] },
      { C: fam.roles.cooperate[1], D: fam.roles.defect[1] },
    ];
  }
  return [
    { C: 0, D: 1 },
    { C: 0, D: 1 },
  ];
}

function checkRoles(roles: [ActionRoles, ActionRoles]): void {
  for (const r of roles) {
    if (!((r.C === 0 && r.D === 1) || (r.C === 1 && r.D === 0))) throw new RangeError('roles must map C and D to distinct actions 0 and 1');
  }
}

export interface RoundRecord {
  /** 1-based round number. */
  round: number;
  actions: Profile;
  payoffs: [Rational, Rational];
}

/** A deterministic user policy: chooses the user's action index from the history so far. */
export type UserPolicyFn = (history: readonly RoundRecord[]) => number;

export type UserSpec = readonly number[] | RepeatedStrategy | UserPolicyFn;

export interface SimulationOptions {
  seed: number | string;
  /** Override the game's horizon (e.g. to replay with a different T or delta). */
  horizon?: Horizon;
  /** Which player the user controls (default 0). */
  userPlayer?: 0 | 1;
  roles?: [ActionRoles, ActionRoles];
  /** Safety cap for continuation horizons (default 10000). */
  maxRounds?: number;
}

export interface RepeatedSimulation {
  seed: number | string;
  horizon: Horizon;
  userPlayer: 0 | 1;
  rounds: RoundRecord[];
  /** Realised undiscounted totals. */
  totals: [Rational, Rational];
  /** Sum of delta^(t-1) * u_t over realised rounds (continuation horizons only). */
  discountedTotals: [Rational, Rational] | null;
  endReason: RepeatedEndReason | 'moves-exhausted';
  /** Final automaton states (null for users given by moves or a policy function). */
  finalStates: [string | null, string | null];
}

const STREAM_TERMINATION = 0;
const STREAM_PLAYER = [1, 2] as const;

/**
 * Fully reproducible simulation. Randomness comes from three independent streams derived
 * from `seed` (termination, player 0, player 1); every round consumes exactly one draw per
 * player stream whether or not it is needed, so changing one player's actions never shifts
 * the other player's or the termination draws (counterfactual replays stay aligned).
 */
export function simulateRepeated(
  game: RepeatedGame,
  user: UserSpec,
  opponent: RepeatedStrategy,
  options: SimulationOptions,
): RepeatedSimulation {
  assertRepeated(game);
  const horizon = options.horizon ?? game.horizon;
  const g: RepeatedGame = { ...game, horizon };
  assertRepeated(g);
  const userPlayer = options.userPlayer ?? 0;
  const oppPlayer = (1 - userPlayer) as 0 | 1;
  const bm = compile(game.stage);
  const needsRoles = !Array.isArray(user) && typeof user !== 'function';
  const roles = options.roles ?? defaultRoles(game.stage);
  checkRoles(roles);
  validateStrategy(opponent);
  if (needsRoles) validateStrategy(user as RepeatedStrategy);
  if (Array.isArray(user)) {
    const k = userPlayer === 0 ? bm.m : bm.n;
    for (const a of user) if (!Number.isInteger(a) || a < 0 || a >= k) throw new RangeError(`user move ${a} out of range`);
  }

  const strategies: [RepeatedStrategy | null, RepeatedStrategy | null] = [null, null];
  strategies[oppPlayer] = opponent;
  if (needsRoles) strategies[userPlayer] = user as RepeatedStrategy;
  const autoState: [string | null, string | null] = [strategies[0]?.initial ?? null, strategies[1]?.initial ?? null];
  const rngs: [RngState, RngState] = [
    seedRng(deriveSeed(options.seed, STREAM_PLAYER[0])),
    seedRng(deriveSeed(options.seed, STREAM_PLAYER[1])),
  ];
  let state = initialState(g, {
    seed: deriveSeed(options.seed, STREAM_TERMINATION),
    ...(options.maxRounds !== undefined ? { maxRounds: options.maxRounds } : {}),
  }) as RepeatedState;
  const rounds: RoundRecord[] = [];
  const delta = horizon.type === 'continuation' ? Rational.parse(horizon.delta) : null;
  let disc: [Rational, Rational] = [Rational.ZERO, Rational.ZERO];
  let weight = Rational.ONE;
  let endReason: RepeatedSimulation['endReason'] | null = null;

  while (!state.ended) {
    const actions: [number, number] = [0, 0];
    for (const p of [0, 1] as const) {
      // Exactly one draw per player stream per round, used or not.
      const strat = strategies[p];
      const st = strat ? strat.states[autoState[p]!]! : null;
      const draw = nextBernoulli(rngs[p], st ? coopProbability(st) : Rational.ONE);
      rngs[p] = draw.state;
      if (st) {
        actions[p] = draw.value ? roles[p].C : roles[p].D;
      } else if (Array.isArray(user)) {
        if (rounds.length >= user.length) {
          endReason = 'moves-exhausted';
          break;
        }
        actions[p] = user[rounds.length]!;
      } else {
        const a = (user as UserPolicyFn)(rounds);
        const k = p === 0 ? bm.m : bm.n;
        if (!Number.isInteger(a) || a < 0 || a >= k) throw new RangeError(`user policy returned illegal action ${a}`);
        actions[p] = a;
      }
    }
    if (endReason) break;
    state = step(g, state, { player: 0, action: actions[0] }) as RepeatedState;
    state = step(g, state, { player: 1, action: actions[1] }) as RepeatedState;
    const payoffs: [Rational, Rational] = [bm.A[actions[0]]![actions[1]]!, bm.B[actions[0]]![actions[1]]!];
    rounds.push({ round: rounds.length + 1, actions: [actions[0], actions[1]], payoffs });
    if (delta) {
      disc = [disc[0].add(weight.mul(payoffs[0])), disc[1].add(weight.mul(payoffs[1]))];
      weight = weight.mul(delta);
    }
    for (const p of [0, 1] as const) {
      const strat = strategies[p];
      if (!strat) continue;
      const other = 1 - p;
      const role: RoleAction = actions[other] === roles[other]!.C ? 'C' : 'D';
      autoState[p] = strat.states[autoState[p]!]!.next[role];
    }
  }
  const totals: [Rational, Rational] = [Rational.ZERO, Rational.ZERO];
  for (const rr of rounds) {
    totals[0] = totals[0].add(rr.payoffs[0]);
    totals[1] = totals[1].add(rr.payoffs[1]);
  }
  return {
    seed: options.seed,
    horizon,
    userPlayer,
    rounds,
    totals,
    discountedTotals: delta ? disc : null,
    endReason: endReason ?? state.endReason!,
    finalStates: autoState,
  };
}

/**
 * Exact expected totals when both players use automaton strategies.
 * Continuation horizon: E[sum_{t>=0} delta^t u_t] (the game reaches round t+1 with probability delta^t),
 * computed by solving (I - delta P) V = r on the joint-state Markov chain.
 * Fixed horizon T: E[sum_{t<T} u_t].
 */
export function expectedRepeatedPayoffs(
  game: RepeatedGame,
  strategies: [RepeatedStrategy, RepeatedStrategy],
  options: { roles?: [ActionRoles, ActionRoles]; horizon?: Horizon } = {},
): [Rational, Rational] {
  assertRepeated(game);
  const horizon = options.horizon ?? game.horizon;
  assertRepeated({ ...game, horizon });
  const bm = compile(game.stage);
  const roles = options.roles ?? defaultRoles(game.stage);
  checkRoles(roles);
  strategies.forEach(validateStrategy);
  const [s0, s1] = strategies;
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const index = new Map<string, number>();
  const list: [string, string][] = [];
  const queue: [string, string][] = [[s0.initial, s1.initial]];
  const trans: { to: [string, string]; prob: Rational }[][] = [];
  const rewards: [Rational, Rational][] = [];
  while (queue.length > 0) {
    const [a, b] = queue.shift()!;
    const k = key(a, b);
    if (index.has(k)) continue;
    index.set(k, list.length);
    list.push([a, b]);
    const p0 = coopProbability(s0.states[a]!);
    const p1 = coopProbability(s1.states[b]!);
    const out: { to: [string, string]; prob: Rational }[] = [];
    let r0 = Rational.ZERO;
    let r1 = Rational.ZERO;
    for (const x of ['C', 'D'] as const) {
      for (const y of ['C', 'D'] as const) {
        const prob = (x === 'C' ? p0 : Rational.ONE.sub(p0)).mul(y === 'C' ? p1 : Rational.ONE.sub(p1));
        if (prob.isZero()) continue;
        const i = roles[0][x];
        const j = roles[1][y];
        r0 = r0.add(prob.mul(bm.A[i]![j]!));
        r1 = r1.add(prob.mul(bm.B[i]![j]!));
        const to: [string, string] = [s0.states[a]!.next[y], s1.states[b]!.next[x]];
        out.push({ to, prob });
        if (!index.has(key(...to))) queue.push(to);
      }
    }
    trans.push(out);
    rewards.push([r0, r1]);
  }
  const N = list.length;
  const idx = (s: [string, string]) => index.get(key(...s))!;
  if (horizon.type === 'fixed') {
    let V: [Rational, Rational][] = list.map(() => [Rational.ZERO, Rational.ZERO]);
    for (let t = 0; t < horizon.rounds; t++) {
      V = list.map((_, s) => {
        let v0 = rewards[s]![0];
        let v1 = rewards[s]![1];
        for (const { to, prob } of trans[s]!) {
          v0 = v0.add(prob.mul(V[idx(to)]![0]));
          v1 = v1.add(prob.mul(V[idx(to)]![1]));
        }
        return [v0, v1];
      });
    }
    return V[0]!;
  }
  const delta = Rational.parse(horizon.delta);
  const M: Rational[][] = Array.from({ length: N }, (_, s) => Array.from({ length: N }, (_, t) => (s === t ? Rational.ONE : Rational.ZERO)));
  trans.forEach((out, s) => {
    for (const { to, prob } of out) {
      const t = idx(to);
      M[s]![t] = M[s]![t]!.sub(delta.mul(prob));
    }
  });
  const v0 = solveLinear(M, rewards.map((r) => r[0]))!;
  const v1 = solveLinear(M, rewards.map((r) => r[1]))!;
  return [v0[0]!, v1[0]!];
}

export interface GrimThreshold {
  applicable: boolean;
  reason: string;
  /** max over players of (T - R) / (T - P). */
  deltaStar: Rational | null;
  perPlayer: [Rational, Rational] | null;
  roles: [ActionRoles, ActionRoles] | null;
}

/**
 * Grim-trigger threshold for a Prisoner's Dilemma stage game: (Grim, Grim) is a subgame-perfect
 * equilibrium of the indefinitely repeated game iff delta >= delta* = (T - R) / (T - P) for each
 * player (from R / (1 - delta) >= T + delta P / (1 - delta)).
 */
export function grimTriggerThreshold(stage: NormalGame): GrimThreshold {
  const fam = classifyFamily(stage);
  if (fam.family !== 'prisoners_dilemma' || !fam.values || !fam.roles) {
    return {
      applicable: false,
      reason: `stage game is not a Prisoner's Dilemma (classified as ${fam.family})`,
      deltaStar: null,
      perPlayer: null,
      roles: null,
    };
  }
  const per = fam.values.map((v) => v.T.sub(v.R).div(v.T.sub(v.P))) as [Rational, Rational];
  return {
    applicable: true,
    reason: "Prisoner's Dilemma stage game",
    deltaStar: per[0].ge(per[1]) ? per[0] : per[1],
    perPlayer: per,
    roles: [
      { C: fam.roles.cooperate[0], D: fam.roles.defect[0] },
      { C: fam.roles.cooperate[1], D: fam.roles.defect[1] },
    ],
  };
}

export interface GrimSustainability {
  applicable: boolean;
  sustainable: boolean | null;
  delta: Rational;
  deltaStar: Rational | null;
  /** Value of cooperating forever against Grim, R / (1 - delta), per player. */
  cooperateValue: [Rational, Rational] | null;
  /** Best deviation against Grim (defect now, then defect forever): T + delta P / (1 - delta), per player. */
  deviateValue: [Rational, Rational] | null;
}

/**
 * Is mutual cooperation sustainable by grim trigger at this delta? Uses the weak inequality
 * (at delta = delta* players are indifferent; the profile is still an equilibrium).
 * Cooperation being sustainable means it is POSSIBLE as an equilibrium, not predicted.
 */
export function isGrimSustainable(stage: NormalGame, delta: RationalLike): GrimSustainability {
  const d = Rational.from(delta);
  if (!(d.gt(0) && d.lt(1))) throw new RangeError('delta must satisfy 0 < delta < 1');
  const th = grimTriggerThreshold(stage);
  if (!th.applicable) {
    return { applicable: false, sustainable: null, delta: d, deltaStar: null, cooperateValue: null, deviateValue: null };
  }
  const fam = classifyFamily(stage);
  const one = Rational.ONE.sub(d);
  const coop = fam.values!.map((v) => v.R.div(one)) as [Rational, Rational];
  const dev = fam.values!.map((v) => v.T.add(d.mul(v.P).div(one))) as [Rational, Rational];
  return { applicable: true, sustainable: d.ge(th.deltaStar!), delta: d, deltaStar: th.deltaStar, cooperateValue: coop, deviateValue: dev };
}

export interface FiniteHorizonUnravelling {
  applies: boolean;
  reason: string;
  rounds: number | null;
  /** The unique stage equilibrium, when it exists. */
  stageEquilibrium: MixedProfile | null;
  /** Backward-induction argument, from the last round to the first. */
  steps: { round: number; argument: 'last-round-is-one-shot' | 'future-play-fixed-so-round-is-one-shot'; play: MixedProfile }[];
}

/**
 * Known finite horizon: if the stage game has a UNIQUE Nash equilibrium, the unique
 * subgame-perfect equilibrium of the T-times repeated game plays it in every round
 * (in the PD: defect in every round). With several stage equilibria the argument does not apply.
 */
export function finiteHorizonUnravelling(game: RepeatedGame): FiniteHorizonUnravelling {
  assertRepeated(game);
  if (game.horizon.type !== 'fixed') {
    return { applies: false, reason: 'horizon is not a known fixed number of rounds', rounds: null, stageEquilibrium: null, steps: [] };
  }
  const T = game.horizon.rounds;
  const eq = solveEquilibria(game.stage);
  const total = eq.pure.length + eq.mixed.length + eq.continua.length;
  if (!eq.complete || total !== 1 || eq.continua.length > 0) {
    return {
      applies: false,
      reason: 'stage game does not have a unique Nash equilibrium; threats of switching between stage equilibria can support other play before the last round',
      rounds: T,
      stageEquilibrium: null,
      steps: [],
    };
  }
  const ne = eq.extremeEquilibria[0]!;
  const steps: FiniteHorizonUnravelling['steps'] = [];
  for (let t = T; t >= 1; t--) {
    steps.push({ round: t, argument: t === T ? 'last-round-is-one-shot' : 'future-play-fixed-so-round-is-one-shot', play: ne });
  }
  return { applies: true, reason: 'stage game has a unique Nash equilibrium', rounds: T, stageEquilibrium: ne, steps };
}
