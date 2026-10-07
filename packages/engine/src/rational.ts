/**
 * Exact rational arithmetic.
 *
 * Every payoff, probability, expected value and threshold inside the engine is a
 * `Rational`: a normalised fraction n/d with bigint numerator and denominator,
 * d > 0 and gcd(|n|, d) = 1. Normalisation makes structural equality coincide
 * with numerical equality, so ties are detected exactly (1/3 + 1/3 + 1/3 === 1).
 *
 * Floating point is deliberately unreachable: `valueOf` / `Symbol.toPrimitive`
 * throw for numeric hints, so `a < b` or `a + 1` on Rationals fails loudly
 * instead of silently using floats. `toNumber()` exists for display only.
 */

/** Serialised rational: an integer ("3", "-2") or a fraction ("-1/2"). */
export type RationalString = string;

/** Anything the engine accepts as an exact rational. Numbers must be safe integers. */
export type RationalLike = Rational | RationalString | number | bigint;

const RATIONAL_RE = /^(-?\d+)(?:\/(\d+))?$/;

function bigAbs(a: bigint): bigint {
  return a < 0n ? -a : a;
}

function gcd(a: bigint, b: bigint): bigint {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export class Rational {
  /** Numerator (sign carrier). */
  readonly n: bigint;
  /** Denominator, always > 0. */
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  /** Build n/d, normalising sign and common factors. Throws on d = 0. */
  static of(n: bigint | number, d: bigint | number = 1n): Rational {
    const nn = typeof n === 'bigint' ? n : intToBig(n);
    let dd = typeof d === 'bigint' ? d : intToBig(d);
    if (dd === 0n) throw new RangeError('Rational: zero denominator');
    let num = nn;
    if (dd < 0n) {
      num = -num;
      dd = -dd;
    }
    const g = gcd(num, dd);
    if (g > 1n) {
      num /= g;
      dd /= g;
    }
    return new Rational(num, dd);
  }

  /** Parse "3", "-4", "1/2", "-7/3". Decimals and whitespace are rejected. */
  static parse(s: string): Rational {
    const m = RATIONAL_RE.exec(s);
    if (!m) {
      throw new SyntaxError(
        `Rational: cannot parse ${JSON.stringify(s)}; expected an integer or "p/q" (e.g. "3", "-1/2")`,
      );
    }
    const n = BigInt(m[1]!);
    const d = m[2] === undefined ? 1n : BigInt(m[2]);
    if (d === 0n) throw new RangeError(`Rational: zero denominator in ${JSON.stringify(s)}`);
    return Rational.of(n, d);
  }

  /** True if `s` is a syntactically valid rational string with a non-zero denominator. */
  static isRationalString(s: unknown): s is RationalString {
    if (typeof s !== 'string') return false;
    const m = RATIONAL_RE.exec(s);
    return m !== null && (m[2] === undefined || BigInt(m[2]) !== 0n);
  }

  static from(x: RationalLike): Rational {
    if (x instanceof Rational) return x;
    if (typeof x === 'string') return Rational.parse(x);
    if (typeof x === 'bigint') return new Rational(x, 1n);
    return Rational.of(intToBig(x));
  }

  static readonly ZERO = new Rational(0n, 1n);
  static readonly ONE = new Rational(1n, 1n);

  add(o: RationalLike): Rational {
    const b = Rational.from(o);
    return Rational.of(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(o: RationalLike): Rational {
    const b = Rational.from(o);
    return Rational.of(this.n * b.d - b.n * this.d, this.d * b.d);
  }
  mul(o: RationalLike): Rational {
    const b = Rational.from(o);
    return Rational.of(this.n * b.n, this.d * b.d);
  }
  div(o: RationalLike): Rational {
    const b = Rational.from(o);
    if (b.n === 0n) throw new RangeError('Rational: division by zero');
    return Rational.of(this.n * b.d, this.d * b.n);
  }
  neg(): Rational {
    return new Rational(-this.n, this.d);
  }
  abs(): Rational {
    return this.n < 0n ? this.neg() : this;
  }
  /** Integer power (exponent may be negative for non-zero bases). */
  pow(k: number): Rational {
    if (!Number.isSafeInteger(k)) throw new RangeError('Rational.pow: integer exponent required');
    if (k < 0) return Rational.ONE.div(this.pow(-k));
    const e = BigInt(k);
    return Rational.of(this.n ** e, this.d ** e);
  }

  /** Exact three-way comparison: -1, 0 or 1. */
  cmp(o: RationalLike): -1 | 0 | 1 {
    const b = Rational.from(o);
    const l = this.n * b.d;
    const r = b.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: RationalLike): boolean {
    return this.cmp(o) === 0;
  }
  lt(o: RationalLike): boolean {
    return this.cmp(o) < 0;
  }
  le(o: RationalLike): boolean {
    return this.cmp(o) <= 0;
  }
  gt(o: RationalLike): boolean {
    return this.cmp(o) > 0;
  }
  ge(o: RationalLike): boolean {
    return this.cmp(o) >= 0;
  }
  sign(): -1 | 0 | 1 {
    return this.n < 0n ? -1 : this.n > 0n ? 1 : 0;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }

  /** Canonical string: "3", "-1/2". Round-trips through `Rational.parse`. */
  toString(): RationalString {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
  toJSON(): RationalString {
    return this.toString();
  }
  /** DISPLAY ONLY. Never use the result in engine logic. */
  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }

  /** Prevent accidental floating-point coercion (`a < b`, `a + 1`). */
  [Symbol.toPrimitive](hint: string): string {
    if (hint === 'string') return this.toString();
    throw new TypeError('Rational: implicit numeric coercion is forbidden; use cmp/lt/add/...');
  }
  valueOf(): never {
    throw new TypeError('Rational: implicit numeric coercion is forbidden; use cmp/lt/add/...');
  }
}

function intToBig(x: number): bigint {
  if (!Number.isSafeInteger(x)) {
    throw new RangeError(
      `Rational: ${x} is not a safe integer; pass fractions as strings like "1/3" (floats are not accepted)`,
    );
  }
  return BigInt(x);
}

/** Shorthand constructor: r(3), r('1/2'), r(1, 3). */
export function r(x: RationalLike, d?: number | bigint): Rational {
  if (d === undefined) return Rational.from(x);
  const base = Rational.from(x);
  return base.div(typeof d === 'bigint' ? Rational.of(d) : Rational.of(d));
}

export function sum(xs: readonly RationalLike[]): Rational {
  let acc = Rational.ZERO;
  for (const x of xs) acc = acc.add(x);
  return acc;
}

export function dot(a: readonly RationalLike[], b: readonly RationalLike[]): Rational {
  if (a.length !== b.length) throw new RangeError('dot: length mismatch');
  let acc = Rational.ZERO;
  for (let i = 0; i < a.length; i++) acc = acc.add(Rational.from(a[i]!).mul(b[i]!));
  return acc;
}

export function maxOf(xs: readonly Rational[]): Rational {
  if (xs.length === 0) throw new RangeError('maxOf: empty');
  let best = xs[0]!;
  for (const x of xs) if (x.gt(best)) best = x;
  return best;
}

export function minOf(xs: readonly Rational[]): Rational {
  if (xs.length === 0) throw new RangeError('minOf: empty');
  let best = xs[0]!;
  for (const x of xs) if (x.lt(best)) best = x;
  return best;
}

/** Indices whose value equals the maximum (exact ties included), ascending. */
export function argmaxAll(xs: readonly Rational[]): number[] {
  const m = maxOf(xs);
  const out: number[] = [];
  xs.forEach((x, i) => {
    if (x.eq(m)) out.push(i);
  });
  return out;
}
