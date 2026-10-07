/**
 * Game model (schemaVersion 1). Plain JSON: every payoff and probability is a
 * RationalString ("3", "-1/2"), never a float.
 *
 * Indexing convention used by every engine function: players are referred to
 * by index (0 = row / leader, 1 = column / follower) and actions by their index
 * in the player's ordered `actions` array. Ids and labels are for content/UI.
 */
import type { RationalString } from './rational.js';

export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export interface Action {
  id: string;
  label: string;
}

export interface Player {
  id: string;
  label: string;
  /** Ordered actions; engine results refer to actions by index into this array. */
  actions: Action[];
}

/** How payoffs may be interpreted. Only `cardinal` payoffs support expected values / mixed probabilities. */
export type PayoffScale = 'ordinal' | 'cardinal';

/**
 * RESERVED for hidden information (types / chance / information sets).
 * Not implemented in schemaVersion 1: validation rejects any non-empty value.
 * Planned approach (Harsanyi): a chance move at the root draws player types
 * with a declared prior; information sets group nodes a player cannot tell
 * apart. Adding these later is additive and does not change existing fields.
 */
export interface ReservedHiddenInformation {
  /** RESERVED. Per player id: the possible types and their prior probabilities. */
  playerTypes?: Record<string, { id: string; label: string; prior: RationalString }[]>;
  /** RESERVED. Chance moves: outcomes with probabilities. */
  chance?: { id: string; outcomes: { id: string; label: string; probability: RationalString }[] }[];
  /** RESERVED. Sets of decision points a player cannot distinguish. */
  informationSets?: { id: string; player: string; nodeIds: string[] }[];
}

interface GameBase {
  schemaVersion: SchemaVersion;
  /** Optional content identifier; not interpreted by the engine. */
  id?: string;
  /** Optional title; not interpreted by the engine. */
  title?: string;
  /** RESERVED (see ReservedHiddenInformation). Must be absent or empty in V1. */
  hiddenInformation?: ReservedHiddenInformation;
}

/**
 * Simultaneous-move game in normal (strategic) form.
 * V1: exactly two players. `payoffs[i][j]` is the payoff vector (one entry per
 * player, in player order) when player 0 plays action i and player 1 plays j.
 */
export interface NormalGame extends GameBase {
  kind: 'normal';
  players: Player[];
  payoffs: RationalString[][][];
  payoffScale: PayoffScale;
}

/**
 * Minimal two-stage perfect-information game. players[0] (leader) moves first;
 * players[1] (follower) observes the leader's action, then moves.
 * `payoffs[a][b]` = [leader payoff, follower payoff]. No chance, no hidden info.
 */
export interface Sequential2Game extends GameBase {
  kind: 'sequential2';
  players: Player[];
  payoffs: RationalString[][][];
  payoffScale: PayoffScale;
}

export type Horizon =
  | { type: 'fixed'; rounds: number }
  /** After each round the game continues with probability delta (0 < delta < 1). */
  | { type: 'continuation'; delta: RationalString };

/** Repeated play of a two-player normal-form stage game with perfect monitoring. */
export interface RepeatedGame extends GameBase {
  kind: 'repeated';
  stage: NormalGame;
  horizon: Horizon;
  monitoring: 'perfect';
}

export type GameDefinition = NormalGame | Sequential2Game | RepeatedGame;

/** Pure profile: [action of player 0, action of player 1]. */
export type Profile = [number, number];

/** Discipline labels (plan §8.1). */
export type Discipline = 'GT' | 'DT' | 'BGT' | 'BE' | 'COMPUTATIONAL' | 'OUTSIDE_FORMAL';
