import { describe, expect, it } from 'vitest';
import { Rational, r, sum, dot, maxOf, minOf, argmaxAll } from '../../src/index.js';

describe('Rational', () => {
  it('normalises sign and common factors', () => {
    expect(Rational.of(2, 4).toString()).toBe('1/2');
    expect(Rational.of(3, -6).toString()).toBe('-1/2');
    expect(Rational.of(-3n, -6n).toString()).toBe('1/2');
    expect(Rational.of(0, -5).toString()).toBe('0');
    expect(Rational.of(0, -5).d).toBe(1n);
    expect(Rational.of(6, 3).isInteger()).toBe(true);
  });

  it('parses canonical strings and rejects floats/garbage', () => {
    expect(Rational.parse('3').toString()).toBe('3');
    expect(Rational.parse('-1/2').toString()).toBe('-1/2');
    expect(Rational.parse('10/4').toString()).toBe('5/2');
    for (const bad of ['0.5', '1/0', ' 1', '1/-2', '', 'abc', '1e3', '+1']) {
      expect(() => Rational.parse(bad)).toThrow();
    }
    expect(Rational.isRationalString('7/3')).toBe(true);
    expect(Rational.isRationalString('7/0')).toBe(false);
    expect(Rational.isRationalString(7)).toBe(false);
  });

  it('rejects non-integer numbers and zero denominators', () => {
    expect(() => Rational.from(0.5)).toThrow(/safe integer/);
    expect(() => Rational.of(1, 0)).toThrow(/zero denominator/);
    expect(() => r(1).div(0)).toThrow(/division by zero/);
    expect(Rational.from(5n).toString()).toBe('5');
    expect(r(1, 3).toString()).toBe('1/3');
    expect(r('1/2', 2n).toString()).toBe('1/4');
  });

  it('exact tie: 1/3 + 1/3 + 1/3 === 1 (and 0.1 + 0.2 style traps)', () => {
    const third = r('1/3');
    expect(third.add(third).add(third).eq(1)).toBe(true);
    expect(sum(['1/10', '2/10']).eq('3/10')).toBe(true);
    // A value engineered to break floating point: 1/3 vs 0.333... as a fraction.
    expect(r('1/3').eq('333333333333333/1000000000000000')).toBe(false);
    expect(r('1/3').gt('333333333333333/1000000000000000')).toBe(true);
  });

  it('arithmetic and comparisons', () => {
    const a = r('2/3');
    const b = r('-1/4');
    expect(a.add(b).toString()).toBe('5/12');
    expect(a.sub(b).toString()).toBe('11/12');
    expect(a.mul(b).toString()).toBe('-1/6');
    expect(a.div(b).toString()).toBe('-8/3');
    expect(b.neg().toString()).toBe('1/4');
    expect(b.abs().toString()).toBe('1/4');
    expect(a.abs()).toBe(a);
    expect(a.pow(2).toString()).toBe('4/9');
    expect(a.pow(-2).toString()).toBe('9/4');
    expect(a.pow(0).toString()).toBe('1');
    expect(() => a.pow(0.5)).toThrow();
    expect(a.cmp(b)).toBe(1);
    expect(b.cmp(a)).toBe(-1);
    expect(a.cmp('4/6')).toBe(0);
    expect(a.lt(1) && a.le(1) && a.gt(0) && a.ge('2/3')).toBe(true);
    expect(b.sign()).toBe(-1);
    expect(Rational.ZERO.sign()).toBe(0);
    expect(a.sign()).toBe(1);
    expect(Rational.ZERO.isZero()).toBe(true);
  });

  it('forbids implicit numeric coercion but allows string conversion', () => {
    const a = r('1/2') as unknown as number;
    expect(() => a + 1).toThrow(TypeError);
    expect(() => a < 1).toThrow(TypeError);
    expect(() => (r(1) as unknown as { valueOf(): unknown }).valueOf()).toThrow(TypeError);
    expect(`${r('1/2')}`).toBe('1/2');
    expect(JSON.stringify({ x: r('-3/4') })).toBe('{"x":"-3/4"}');
    expect(r('1/4').toNumber()).toBe(0.25);
  });

  it('helpers', () => {
    expect(dot(['1/2', '1/2'], [2, 4]).toString()).toBe('3');
    expect(() => dot([1], [1, 2])).toThrow();
    const xs = [r(1), r(3), r(3), r(-1)];
    expect(maxOf(xs).toString()).toBe('3');
    expect(minOf(xs).toString()).toBe('-1');
    expect(argmaxAll(xs)).toEqual([1, 2]);
    expect(() => maxOf([])).toThrow();
    expect(() => minOf([])).toThrow();
  });

  it('handles large values without overflow', () => {
    const big = r('123456789012345678901234567890/7');
    expect(big.mul(7).toString()).toBe('123456789012345678901234567890');
  });
});
