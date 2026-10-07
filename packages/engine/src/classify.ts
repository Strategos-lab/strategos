/**
 * Ordinal family classifier for 2x2 games.
 *
 * Role families (PD, Stag Hunt, Chicken, Harmony, Deadlock) are tested for every
 * assignment of the "cooperate" (C) / "defect" (D) roles to each player's two
 * actions. For an assignment, each player's own payoffs are named
 *   R = (C, C)   S = (own C, other D)   T = (own D, other C)   P = (D, D)
 * and the family rule must hold for BOTH players (so ordinally symmetric games
 * with different cardinal numbers still classify; relabelling actions or
 * swapping players never changes the family). Rules (all strict unless stated):
 *   Prisoner's Dilemma : T > R > P > S            (also reports 2R > T + S)
 *   Stag Hunt          : R > T >= P > S           (tie T = P explicitly allowed)
 *   Chicken / Hawk-Dove: T > R > S > P
 *   Harmony            : R > T, R > S, S > P      (C strictly dominant and (C,C) each player's best outcome)
 *   Deadlock           : T > P > R, P > S         (D strictly dominant, (D,D) better than (C,C), yet T > P)
 * Structural families (no role labels):
 *   Matching Pennies   : constant-sum and no pure Nash equilibrium
 *   Pure coordination  : two strict pure NE (no shared row/column) and both players rank all four outcomes identically
 *   Battle of the Sexes: two strict pure NE (no shared row/column); the players strictly disagree on which NE is better;
 *                        each player strictly prefers both NE outcomes to both other outcomes (ties among the latter allowed)
 * Anything else, including any game where a required strict inequality is a tie, is 'other'.
 */
import { compile, type MatrixGame } from './compile.js';
import { pureNash } from './equilibria.js';
import type { Rational } from './rational.js';
import type { Profile } from './types.js';

export type GameFamily =
  | 'prisoners_dilemma'
  | 'stag_hunt'
  | 'chicken'
  | 'harmony'
  | 'deadlock'
  | 'pure_coordination'
  | 'battle_of_the_sexes'
  | 'matching_pennies'
  | 'other';

export interface RoleValues {
  R: Rational;
  S: Rational;
  T: Rational;
  P: Rational;
}

export interface FamilyClassification {
  family: GameFamily;
  /** False if the game is not 2x2 (family is then 'other'). */
  applicable: boolean;
  /** Inequalities / facts that established the family (or why none matched). */
  reasons: string[];
  /** Role assignment used for role families: action index of C and D for each player. */
  roles?: { cooperate: [number, number]; defect: [number, number] };
  /** R, S, T, P per player under `roles`. */
  values?: [RoleValues, RoleValues];
  /** Prisoner's Dilemma only: 2R > T + S per player (alternating exploitation is worse than mutual cooperation). */
  pdRepeatedCondition?: { holds: boolean; perPlayer: [boolean, boolean] };
  /** Pure coordination only. */
  subtype?: 'equal-equilibria' | 'ranked-equilibria';
  /** Exactly symmetric (u1(a, b) = u0(b, a)) under some relabelling of player 1's actions. */
  symmetric: boolean;
  /** Ties among each player's four payoffs (exact). */
  ties: string[];
  /** All families whose rules matched (normally 0 or 1). */
  matches: GameFamily[];
}

type Rule = { family: GameFamily; test: (v: RoleValues) => string[] | null };

const fmt = (name: string, x: Rational) => `${name} (${x})`;

function chain(v: RoleValues, spec: [keyof RoleValues, '>' | '>=', keyof RoleValues][]): string[] | null {
  const out: string[] = [];
  for (const [a, op, b] of spec) {
    const c = v[a].cmp(v[b]);
    if (op === '>' ? c <= 0 : c < 0) return null;
    out.push(`${fmt(a, v[a])} ${op === '>' || c > 0 ? '>' : '='} ${fmt(b, v[b])}`);
  }
  return out;
}

const RULES: Rule[] = [
  { family: 'prisoners_dilemma', test: (v) => chain(v, [['T', '>', 'R'], ['R', '>', 'P'], ['P', '>', 'S']]) },
  { family: 'stag_hunt', test: (v) => chain(v, [['R', '>', 'T'], ['T', '>=', 'P'], ['P', '>', 'S']]) },
  { family: 'chicken', test: (v) => chain(v, [['T', '>', 'R'], ['R', '>', 'S'], ['S', '>', 'P']]) },
  { family: 'harmony', test: (v) => chain(v, [['R', '>', 'T'], ['R', '>', 'S'], ['S', '>', 'P']]) },
  { family: 'deadlock', test: (v) => chain(v, [['T', '>', 'P'], ['P', '>', 'R'], ['P', '>', 'S']]) },
];

function roleValues(A: Rational[][], B: Rational[][], cr: number, cc: number): [RoleValues, RoleValues] {
  const dr = 1 - cr;
  const dc = 1 - cc;
  return [
    { R: A[cr]![cc]!, S: A[cr]![dc]!, T: A[dr]![cc]!, P: A[dr]![dc]! },
    { R: B[cr]![cc]!, S: B[dr]![cc]!, T: B[cr]![dc]!, P: B[dr]![dc]! },
  ];
}

function isSymmetric(A: Rational[][], B: Rational[][]): boolean {
  for (const swap of [false, true]) {
    const s = (j: number) => (swap ? 1 - j : j);
    let ok = true;
    for (let i = 0; i < 2 && ok; i++) {
      for (let j = 0; j < 2 && ok; j++) {
        // After relabelling column j -> s(j), symmetry: B'[i][j] = A'[j][i].
        if (!B[i]![s(j)]!.eq(A[j]![s(i)]!)) ok = false;
      }
    }
    if (ok) return true;
  }
  return false;
}

function tiesOf(A: Rational[][], B: Rational[][]): string[] {
  const out: string[] = [];
  const cells: Profile[] = [[0, 0], [0, 1], [1, 0], [1, 1]];
  for (const [p, M] of [[0, A], [1, B]] as const) {
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        const [i, j] = cells[a]!;
        const [k, l] = cells[b]!;
        if (M[i]![j]!.eq(M[k]![l]!)) out.push(`player ${p}: payoff at (${i},${j}) = payoff at (${k},${l}) = ${M[i]![j]!}`);
      }
    }
  }
  return out;
}

export function classifyFamily(game: MatrixGame): FamilyClassification {
  const bm = compile(game);
  if (bm.m !== 2 || bm.n !== 2) {
    return {
      family: 'other',
      applicable: false,
      reasons: [`family classification applies to 2x2 games only (this game is ${bm.m}x${bm.n})`],
      symmetric: false,
      ties: [],
      matches: [],
    };
  }
  const { A, B } = bm;
  const symmetric = isSymmetric(A, B);
  const ties = tiesOf(A, B);
  type Hit = Omit<FamilyClassification, 'symmetric' | 'ties' | 'matches' | 'applicable'>;
  const hits: Hit[] = [];

  for (const rule of RULES) {
    let found: Hit | null = null;
    for (const cr of [0, 1]) {
      for (const cc of [0, 1]) {
        if (found) continue;
        const vals = roleValues(A, B, cr, cc);
        const r0 = rule.test(vals[0]);
        const r1 = rule.test(vals[1]);
        if (r0 && r1) {
          const hit: Hit = {
            family: rule.family,
            reasons: [...r0.map((s) => `player 0: ${s}`), ...r1.map((s) => `player 1: ${s}`)],
            roles: { cooperate: [cr, cc], defect: [1 - cr, 1 - cc] },
            values: vals,
          };
          if (rule.family === 'prisoners_dilemma') {
            const per = vals.map((v) => v.R.add(v.R).gt(v.T.add(v.S))) as [boolean, boolean];
            hit.pdRepeatedCondition = { holds: per[0] && per[1], perPlayer: per };
            vals.forEach((v, p) =>
              hit.reasons.push(`player ${p}: 2R (${v.R.add(v.R)}) ${per[p] ? '>' : '<='} T + S (${v.T.add(v.S)})`),
            );
          }
          found = hit;
        }
      }
    }
    if (found) hits.push(found);
  }

  const ne = pureNash(game);
  // Matching pennies family: constant-sum, no pure NE.
  const total = A[0]![0]!.add(B[0]![0]!);
  const constantSum = [0, 1].every((i) => [0, 1].every((j) => A[i]![j]!.add(B[i]![j]!).eq(total)));
  if (constantSum && ne.length === 0) {
    hits.push({ family: 'matching_pennies', reasons: [`constant-sum (every cell sums to ${total})`, 'no pure Nash equilibrium'] });
  }

  // Two strict pure NE not sharing a row or column.
  const strict = (p: Profile) => {
    const [i, j] = p;
    return A[i]![j]!.gt(A[1 - i]![j]!) && B[i]![j]!.gt(B[i]![1 - j]!);
  };
  if (ne.length === 2 && ne[0]![0] !== ne[1]![0] && ne[0]![1] !== ne[1]![1] && ne.every(strict)) {
    const [e, f] = ne as [Profile, Profile];
    const others: Profile[] = [
      [e[0], f[1]],
      [f[0], e[1]],
    ];
    const cells: Profile[] = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const sameRanking = cells.every(([i, j]) =>
      cells.every(([k, l]) => A[i]![j]!.cmp(A[k]![l]!) === B[i]![j]!.cmp(B[k]![l]!)),
    );
    const at = (M: Rational[][], p: Profile) => M[p[0]]![p[1]]!;
    if (sameRanking) {
      const equal = at(A, e).eq(at(A, f));
      hits.push({
        family: 'pure_coordination',
        reasons: [
          'two strict pure Nash equilibria',
          'both players rank all four outcomes identically (common interest)',
          equal ? 'the two equilibria are equally good' : 'the equilibria are Pareto-ranked',
        ],
        subtype: equal ? 'equal-equilibria' : 'ranked-equilibria',
      });
    } else {
      const c0 = at(A, e).cmp(at(A, f));
      const c1 = at(B, e).cmp(at(B, f));
      const disagree = c0 !== 0 && c1 !== 0 && c0 !== c1;
      const prefersNE = (M: Rational[][]) => [e, f].every((q) => others.every((o) => at(M, q).gt(at(M, o))));
      if (disagree && prefersNE(A) && prefersNE(B)) {
        hits.push({
          family: 'battle_of_the_sexes',
          reasons: [
            'two strict pure Nash equilibria',
            'player 0 and player 1 strictly prefer different equilibria',
            'each player strictly prefers either equilibrium to every miscoordinated outcome',
          ],
        });
      }
    }
  }

  if (hits.length === 0) {
    return {
      family: 'other',
      applicable: true,
      reasons: ['no family rule matched with strict inequalities', ...(ties.length ? ['ties present (a tie fails a strict rule)'] : [])],
      symmetric,
      ties,
      matches: [],
    };
  }
  const first = hits[0]!;
  return { ...first, applicable: true, symmetric, ties, matches: hits.map((h) => h.family) };
}
