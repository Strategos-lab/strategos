/**
 * Seeded, pure pseudo-random number generation (mulberry32).
 *
 * The generator state is an explicit value: every call takes a state and returns
 * the drawn value together with the next state. Nothing is hidden, nothing is
 * global, and `Math.random` is never used anywhere in the engine (enforced by a
 * test that scans the source tree).
 */
import { Rational } from './rational.js';

export interface RngState {
  /** Unsigned 32-bit generator state. */
  readonly s: number;
}

export interface Draw<T> {
  readonly value: T;
  readonly state: RngState;
}

const TWO_32 = 4294967296n;

/** FNV-1a hash of a string to an unsigned 32-bit integer. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Normalise a seed (safe integer or string) to an unsigned 32-bit integer. */
export function normaliseSeed(seed: number | string): number {
  if (typeof seed === 'string') return hashString(seed);
  if (!Number.isSafeInteger(seed)) throw new RangeError('seed must be a safe integer or a string');
  // Fold high bits so seeds above 2^32 still matter.
  const lo = seed >>> 0;
  const hi = Math.floor(seed / 4294967296) >>> 0;
  return (lo ^ Math.imul(hi, 0x9e3779b1)) >>> 0;
}

/** Create a generator state from a seed. */
export function seedRng(seed: number | string): RngState {
  return { s: normaliseSeed(seed) };
}

/**
 * Derive an independent stream seed from a base seed and a stream number
 * (splitmix32-style finaliser). Used so that, e.g., termination draws and
 * opponent draws never interfere with each other.
 */
export function deriveSeed(seed: number | string, stream: number): number {
  let z = (normaliseSeed(seed) + Math.imul(stream + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

/** mulberry32 step: next unsigned 32-bit value. */
export function nextUint32(state: RngState): Draw<number> {
  const a = (state.s + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = (t ^ (t >>> 14)) >>> 0;
  return { value, state: { s: a } };
}

/**
 * Bernoulli(p) with an exact rational p in [0, 1]: true iff u / 2^32 < p,
 * where u is a uniform 32-bit draw. The comparison is done in bigint, so
 * p = 1 is always true and p = 0 always false.
 */
export function nextBernoulli(state: RngState, p: Rational): Draw<boolean> {
  if (p.lt(0) || p.gt(1)) throw new RangeError('nextBernoulli: p must lie in [0, 1]');
  const d = nextUint32(state);
  return { value: BigInt(d.value) * p.d < p.n * TWO_32, state: d.state };
}

/** Uniform integer in [0, n) by rejection sampling (unbiased). */
export function nextInt(state: RngState, n: number): Draw<number> {
  if (!Number.isSafeInteger(n) || n <= 0 || n > 4294967296) {
    throw new RangeError('nextInt: n must be an integer in [1, 2^32]');
  }
  const limit = 4294967296 - (4294967296 % n);
  let st = state;
  for (;;) {
    const d = nextUint32(st);
    st = d.state;
    if (d.value < limit) return { value: d.value % n, state: st };
  }
}
