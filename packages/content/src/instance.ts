import { bestResponseToMixed, deriveSeed, nextInt, seedRng, type NormalGame } from '@strategos/engine';
import { buildGame, computeFacts, type Params } from './game.ts';
import type { Item, Seat, Skin, Structure, StructuralFacts, Variation } from './types.ts';

/** Everything needed to render and check one concrete item (plan §8.3 ScenarioInstance). */
export interface Instance {
  /** Opaque id: never contains a concept or structure name (plan §2.11). */
  id: string;
  item: Item;
  structure: Structure;
  skin: Skin;
  variation: Variation;
  seat: Seat;
  params: Params;
  game: NormalGame;
  /** Facts recomputed by the engine for this exact parameter set. */
  facts: StructuralFacts;
}

export interface Lookup {
  structure(id: string): Structure | undefined;
  skin(id: string): Skin | undefined;
  variation(id: string): Variation | undefined;
}

export function makeLookup(parts: { structures: Structure[]; skins: Skin[]; variations: Variation[] }): Lookup {
  const s = new Map(parts.structures.map((x) => [x.id, x]));
  const k = new Map(parts.skins.map((x) => [x.id, x]));
  const v = new Map(parts.variations.map((x) => [x.id, x]));
  return { structure: (id) => s.get(id), skin: (id) => k.get(id), variation: (id) => v.get(id) };
}

export function opaqueId(...parts: string[]): string {
  return `x${deriveSeed(parts.join('|'), 11).toString(36)}${deriveSeed(parts.join('|'), 12).toString(36)}`;
}

export function buildInstance(item: Item, skinId: string, variationId: string, look: Lookup): Instance {
  const structure = look.structure(item.structure);
  const skin = look.skin(skinId);
  const variation = look.variation(variationId);
  if (!structure || !skin || !variation) {
    throw new Error(`${item.id}: unresolved reference (${item.structure}, ${skinId}, ${variationId})`);
  }
  const params = variation.params;
  const game = buildGame(structure, params);
  return {
    id: opaqueId(item.id, skinId, variationId),
    item,
    structure,
    skin,
    variation,
    seat: variation.seat,
    params,
    game,
    facts: computeFacts(structure, game),
  };
}

/** Every (skin, variation) instance of an item: what the validator checks exhaustively. */
export function allInstances(item: Item, look: Lookup): Instance[] {
  const out: Instance[] = [];
  for (const k of item.skins) for (const v of item.variations) out.push(buildInstance(item, k, v, look));
  return out;
}

/** Deterministic instance choice from a seed (engine PRNG; no Math.random). */
export function generateInstance(item: Item, seed: number | string, look: Lookup): Instance {
  let st = seedRng(deriveSeed(seed, 31));
  const k = nextInt(st, item.skins.length);
  st = k.state;
  const v = nextInt(st, item.variations.length);
  return buildInstance(item, item.skins[k.value]!, item.variations[v.value]!, look);
}

function beliefMix(inst: Instance): { learner: 0 | 1; mix: string[]; ownIds: string[] } | null {
  const belief = inst.variation.belief;
  if (!belief) return null;
  const learner = inst.seat === 'A' ? 0 : 1;
  const otherIds = learner === 0 ? inst.structure.actions.B : inst.structure.actions.A;
  const ownIds = learner === 0 ? inst.structure.actions.A : inst.structure.actions.B;
  return { learner, mix: otherIds.map((id) => belief[id] ?? '0'), ownIds };
}

/** Learner's exact expected payoff for an own action under their belief (rational string). */
export function expectedUnderBelief(inst: Instance, action: string): string {
  const b = beliefMix(inst);
  if (!b) throw new Error(`${inst.variation.id}: no belief`);
  const i = b.ownIds.indexOf(action);
  if (i < 0) throw new Error(`"${action}" is not the learner's action`);
  return bestResponseToMixed(inst.game, b.learner, b.mix).expected[i]!.toString();
}

/** Learner's best response(s) to their declared belief (exact rationals). */
export function bestToBelief(inst: Instance): string[] {
  const belief = inst.variation.belief;
  if (!belief) return [];
  const learner = inst.seat === 'A' ? 0 : 1;
  const otherIds = learner === 0 ? inst.structure.actions.B : inst.structure.actions.A;
  const mix = otherIds.map((id) => belief[id] ?? '0');
  const ownIds = learner === 0 ? inst.structure.actions.A : inst.structure.actions.B;
  return bestResponseToMixed(inst.game, learner, mix).best.map((i) => ownIds[i]!);
}
