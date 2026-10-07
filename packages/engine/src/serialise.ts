/** Deep conversion of engine results to plain JSON (Rationals become canonical strings). */
import { Rational, type RationalString } from './rational.js';

/** The JSON form of an engine type: every Rational becomes a RationalString. */
export type Jsonify<T> = T extends Rational
  ? RationalString
  : T extends bigint
    ? string
    : T extends readonly (infer U)[]
      ? Jsonify<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : T;

export function toJSONValue<T>(x: T): Jsonify<T> {
  return convert(x) as Jsonify<T>;
}

function convert(x: unknown): unknown {
  if (x instanceof Rational) return x.toString();
  if (typeof x === 'bigint') return x.toString();
  if (Array.isArray(x)) return x.map(convert);
  if (x !== null && typeof x === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) if (v !== undefined) out[k] = convert(v);
    return out;
  }
  return x;
}
