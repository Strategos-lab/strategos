import { describe, expect, it } from 'vitest';
import { deriveSeed, nextBernoulli, nextInt, nextUint32, normaliseSeed, r, seedRng } from '../../src/index.js';

describe('seeded RNG (mulberry32)', () => {
  it('is pure: same state in, same value and state out', () => {
    const s = seedRng(42);
    const a = nextUint32(s);
    const b = nextUint32(s);
    expect(a).toEqual(b);
    expect(a.state).not.toEqual(s);
    expect(s).toEqual(seedRng(42));
  });

  it('known first outputs for seed 1 (pins the algorithm)', () => {
    let st = seedRng(1);
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
      const d = nextUint32(st);
      out.push(d.value);
      st = d.state;
    }
    // mulberry32 reference values for seed 1.
    expect(out).toEqual([2693262067, 11749833, 2265367787]);
  });

  it('seeds: strings hash deterministically; large ints fold high bits; invalid seeds throw', () => {
    expect(normaliseSeed('abc')).toBe(normaliseSeed('abc'));
    expect(normaliseSeed('abc')).not.toBe(normaliseSeed('abd'));
    expect(normaliseSeed(2 ** 40)).not.toBe(normaliseSeed(0));
    expect(() => normaliseSeed(1.5)).toThrow();
    expect(deriveSeed(7, 0)).not.toBe(deriveSeed(7, 1));
    expect(deriveSeed(7, 1)).toBe(deriveSeed(7, 1));
  });

  it('Bernoulli is exact at the boundaries', () => {
    let st = seedRng(3);
    for (let i = 0; i < 200; i++) {
      const one = nextBernoulli(st, r(1));
      const zero = nextBernoulli(st, r(0));
      expect(one.value).toBe(true);
      expect(zero.value).toBe(false);
      st = one.state;
    }
    expect(() => nextBernoulli(st, r(2))).toThrow();
    expect(() => nextBernoulli(st, r(-1))).toThrow();
  });

  it('Bernoulli(1/2) frequency is plausible', () => {
    let st = seedRng(99);
    let k = 0;
    for (let i = 0; i < 4000; i++) {
      const d = nextBernoulli(st, r('1/2'));
      if (d.value) k++;
      st = d.state;
    }
    expect(k).toBeGreaterThan(1800);
    expect(k).toBeLessThan(2200);
  });

  it('nextInt is in range and validates n', () => {
    let st = seedRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const d = nextInt(st, 3);
      expect(d.value).toBeGreaterThanOrEqual(0);
      expect(d.value).toBeLessThan(3);
      seen.add(d.value);
      st = d.state;
    }
    expect(seen.size).toBe(3);
    expect(() => nextInt(st, 0)).toThrow();
    expect(() => nextInt(st, 1.5)).toThrow();
    // n that forces rejection sampling to be exercised
    let st2 = seedRng(11);
    for (let i = 0; i < 50; i++) {
      const d = nextInt(st2, 3000000000);
      expect(d.value).toBeLessThan(3000000000);
      st2 = d.state;
    }
  });
});
