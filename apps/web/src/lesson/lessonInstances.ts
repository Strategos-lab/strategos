/**
 * The only place the generic lesson player touches `@strategos/content`/engine machinery, mirroring
 * how `apps/web/src/slice/engineFacts.ts` isolates the roommate slice's engine touchpoint.
 */
import { deriveSeed, normaliseSeed } from '@strategos/engine';
import { PLAY_CONTENT, generateInstance, makeLookup, type Instance, type Item } from '@strategos/content/play';

const look = makeLookup(PLAY_CONTENT);

/** Deterministic instance of one item for this seed (seeded engine PRNG only). */
export function instanceFor(item: Item, seed: number | string): Instance {
  return generateInstance(item, seed, look);
}

let seedCounter = 0;

export function freshSeed(now: number = Date.now()): number {
  seedCounter += 1;
  return deriveSeed(now, seedCounter);
}

/** Parse a seed given in the URL (?seed=…) for reproducible replays; null if absent/invalid. */
export function parseSeed(raw: string | null): number | null {
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  return normaliseSeed(Number(raw));
}
