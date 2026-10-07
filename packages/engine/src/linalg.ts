/** Exact linear algebra over the rationals (Gaussian elimination). */
import { Rational } from './rational.js';

/**
 * Solve the square system M x = b exactly. Returns null when M is singular
 * (no unique solution). M is not mutated.
 */
export function solveLinear(M: readonly (readonly Rational[])[], b: readonly Rational[]): Rational[] | null {
  const k = M.length;
  if (b.length !== k || M.some((row) => row.length !== k)) {
    throw new RangeError('solveLinear: system must be square and match b');
  }
  const a: Rational[][] = M.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < k; col++) {
    let pivot = -1;
    for (let row = col; row < k; row++) {
      if (!a[row]![col]!.isZero()) {
        pivot = row;
        break;
      }
    }
    if (pivot < 0) return null;
    if (pivot !== col) {
      const tmp = a[pivot]!;
      a[pivot] = a[col]!;
      a[col] = tmp;
    }
    const pr = a[col]!;
    const pv = pr[col]!;
    for (let row = 0; row < k; row++) {
      if (row === col) continue;
      const f = a[row]![col]!;
      if (f.isZero()) continue;
      const factor = f.div(pv);
      const rr = a[row]!;
      for (let c = col; c <= k; c++) rr[c] = rr[c]!.sub(factor.mul(pr[c]!));
    }
  }
  return a.map((row, i) => row[k]!.div(row[i]!));
}

/** Rank of a (not necessarily square) rational matrix. */
export function rank(M: readonly (readonly Rational[])[]): number {
  if (M.length === 0) return 0;
  const a = M.map((row) => [...row]);
  const rows = a.length;
  const cols = a[0]!.length;
  let rk = 0;
  for (let col = 0; col < cols && rk < rows; col++) {
    let pivot = -1;
    for (let row = rk; row < rows; row++) {
      if (!a[row]![col]!.isZero()) {
        pivot = row;
        break;
      }
    }
    if (pivot < 0) continue;
    const tmp = a[pivot]!;
    a[pivot] = a[rk]!;
    a[rk] = tmp;
    const pr = a[rk]!;
    for (let row = rk + 1; row < rows; row++) {
      const f = a[row]![col]!;
      if (f.isZero()) continue;
      const factor = f.div(pr[col]!);
      const rr = a[row]!;
      for (let c = col; c < cols; c++) rr[c] = rr[c]!.sub(factor.mul(pr[c]!));
    }
    rk++;
  }
  return rk;
}

/** Affine dimension of the convex hull of a non-empty point set. */
export function affineDimension(points: readonly (readonly Rational[])[]): number {
  if (points.length <= 1) return 0;
  const p0 = points[0]!;
  return rank(points.slice(1).map((p) => p.map((x, i) => x.sub(p0[i]!))));
}
