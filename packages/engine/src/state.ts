/**
 * Game state machine for all three kinds: initialState, playersToMove, legalActions,
 * step (pure transition), isTerminal, payoffs. States are plain JSON values.
 *
 *  - normal: both players commit (in any order, without observing each other); terminal when both have.
 *  - sequential2: the leader moves, then the follower (who observes the leader's action).
 *  - repeated: rounds of the stage game; after each round a fixed horizon ends at T rounds, a
 *    continuation horizon ends with probability 1 - delta (seeded draw carried in the state).
 */
import { compile } from './compile.js';
import { nextBernoulli, seedRng, type RngState } from './rng.js';
import { Rational } from './rational.js';
import type { GameDefinition, Profile, RepeatedGame } from './types.js';
import { assertValidGame } from './validate.js';

export interface NormalState {
  kind: 'normal';
  /** Committed action per player (null = not yet chosen). */
  chosen: (number | null)[];
}

export interface Sequential2State {
  kind: 'sequential2';
  leader: number | null;
  follower: number | null;
}

export type RepeatedEndReason = 'fixed-horizon' | 'continuation-ended' | 'max-rounds';

export interface RepeatedState {
  kind: 'repeated';
  /** Completed rounds. */
  history: Profile[];
  /** Current round's committed actions. */
  chosen: (number | null)[];
  ended: boolean;
  endReason: RepeatedEndReason | null;
  /** Continuation-draw generator state (null for fixed horizons). */
  rng: RngState | null;
  /** Safety cap for continuation horizons. */
  maxRounds: number;
}

export type GameState = NormalState | Sequential2State | RepeatedState;

export interface Move {
  player: number;
  action: number;
}

export interface InitialStateOptions {
  /** Required for continuation horizons (termination draws). */
  seed?: number | string;
  /** Safety cap on rounds for continuation horizons (default 10000). */
  maxRounds?: number;
}

export const DEFAULT_MAX_ROUNDS = 10000;

function sizes(game: GameDefinition): [number, number] {
  const g = game.kind === 'repeated' ? game.stage : game;
  const bm = compile(g);
  return [bm.m, bm.n];
}

export function initialState(game: GameDefinition, options: InitialStateOptions = {}): GameState {
  assertValidGame(game);
  switch (game.kind) {
    case 'normal':
      return { kind: 'normal', chosen: [null, null] };
    case 'sequential2':
      return { kind: 'sequential2', leader: null, follower: null };
    case 'repeated': {
      const cont = game.horizon.type === 'continuation';
      if (cont && options.seed === undefined) {
        throw new RangeError('initialState: a seed is required for a continuation horizon');
      }
      const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
      if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) throw new RangeError('maxRounds must be a positive integer');
      return {
        kind: 'repeated',
        history: [],
        chosen: [null, null],
        ended: false,
        endReason: null,
        rng: cont ? seedRng(options.seed!) : null,
        maxRounds,
      };
    }
  }
}

function checkKind(game: GameDefinition, state: GameState): void {
  if (game.kind !== state.kind) throw new TypeError(`state of kind "${state.kind}" does not match game of kind "${game.kind}"`);
}

export function isTerminal(game: GameDefinition, state: GameState): boolean {
  checkKind(game, state);
  switch (state.kind) {
    case 'normal':
      return state.chosen.every((c) => c !== null);
    case 'sequential2':
      return state.follower !== null;
    case 'repeated':
      return state.ended;
  }
}

/** Players who may move now (empty when terminal). */
export function playersToMove(game: GameDefinition, state: GameState): number[] {
  if (isTerminal(game, state)) return [];
  switch (state.kind) {
    case 'normal':
    case 'repeated':
      return [0, 1].filter((p) => state.chosen[p] === null);
    case 'sequential2':
      return state.leader === null ? [0] : [1];
  }
}

/** Legal action indices for `player` in `state` (empty if the player cannot move now). */
export function legalActions(game: GameDefinition, state: GameState, player: number): number[] {
  if (!playersToMove(game, state).includes(player)) return [];
  const k = sizes(game)[player]!;
  return Array.from({ length: k }, (_, i) => i);
}

/** Pure transition: returns a new state; throws on an illegal move. */
export function step(game: GameDefinition, state: GameState, move: Move): GameState {
  const legal = legalActions(game, state, move.player);
  if (!legal.includes(move.action)) {
    throw new RangeError(`illegal move: player ${move.player} cannot play action ${move.action} now`);
  }
  switch (state.kind) {
    case 'normal': {
      const chosen = [...state.chosen];
      chosen[move.player] = move.action;
      return { kind: 'normal', chosen };
    }
    case 'sequential2':
      return move.player === 0
        ? { kind: 'sequential2', leader: move.action, follower: null }
        : { kind: 'sequential2', leader: state.leader, follower: move.action };
    case 'repeated': {
      const chosen = [...state.chosen];
      chosen[move.player] = move.action;
      if (chosen.some((c) => c === null)) return { ...state, chosen };
      const g = game as RepeatedGame;
      const history: Profile[] = [...state.history, [chosen[0]!, chosen[1]!]];
      let ended = false;
      let endReason: RepeatedEndReason | null = null;
      let rng = state.rng;
      if (g.horizon.type === 'fixed') {
        if (history.length >= g.horizon.rounds) {
          ended = true;
          endReason = 'fixed-horizon';
        }
      } else {
        const d = nextBernoulli(rng!, Rational.parse(g.horizon.delta));
        rng = d.state;
        if (!d.value) {
          ended = true;
          endReason = 'continuation-ended';
        } else if (history.length >= state.maxRounds) {
          ended = true;
          endReason = 'max-rounds';
        }
      }
      return { kind: 'repeated', history, chosen: [null, null], ended, endReason, rng, maxRounds: state.maxRounds };
    }
  }
}

/**
 * Payoff vector. normal / sequential2: the terminal outcome's payoffs (throws if not terminal).
 * repeated: realised (undiscounted) totals over completed rounds so far.
 */
export function payoffs(game: GameDefinition, state: GameState): Rational[] {
  checkKind(game, state);
  switch (state.kind) {
    case 'normal':
    case 'sequential2': {
      if (!isTerminal(game, state)) throw new RangeError('payoffs: state is not terminal');
      const bm = compile(game as Exclude<GameDefinition, RepeatedGame>);
      const [i, j] = state.kind === 'normal' ? [state.chosen[0]!, state.chosen[1]!] : [state.leader!, state.follower!];
      return [bm.A[i]![j]!, bm.B[i]![j]!];
    }
    case 'repeated': {
      const bm = compile((game as RepeatedGame).stage);
      let u0 = Rational.ZERO;
      let u1 = Rational.ZERO;
      for (const [i, j] of state.history) {
        u0 = u0.add(bm.A[i]![j]!);
        u1 = u1.add(bm.B[i]![j]!);
      }
      return [u0, u1];
    }
  }
}
