import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  HELD_OUT,
  buildGame,
  computeFacts,
  familyCode,
  findConclusions,
  heldOutIsomorphisms,
  ordinallyIsomorphic,
  sequentialIssues,
  skinCounts,
  type Structure,
} from '../src/index.ts';
import { M31_RECALL, ROOMMATE_SLICE, bestResponseRecap, composeSliceM31, composeSliceScenario } from '../src/slice.ts';
import { has, item, run, skin } from './helpers.ts';

const st = (id: string) => [...CONTENT.structures, ...HELD_OUT.structures].find((s) => s.id === id)!;
const dom = CONTENT.concepts.find((c) => c.id === 'dominant_strategy')!;
const g2 = (id: string, m: [number, number][]): Structure => ({
  ...structuredClone(st('m3.s.weak')),
  id,
  payoffs: { 'a1|b1': m[0]!.map(String), 'a1|b2': m[1]!.map(String), 'a2|b1': m[2]!.map(String), 'a2|b2': m[3]!.map(String) } as unknown as Structure['payoffs'],
});

describe('corrective pass: sequential consistency', () => {
  it('m1.s.turns: normal-form facts and backward induction agree', () => {
    const s = st('m1.s.turns');
    expect(sequentialIssues(s, {})).toEqual([]);
    const f = computeFacts(s, buildGame(s, {}));
    expect(f.iesdsSolution).toEqual(['a1', 'b2']);
    expect(f.strictlyDominant.A).toBe('a1');
  });
  it('flags the pre-correction parameterisation (dominance says a1, backward induction says a2)', () => {
    const issues = run((b) => {
      b.structures.find((s) => s.id === 'm1.s.turns')!.payoffs['a1|b2'] = ['1', '3'];
      b.structures.find((s) => s.id === 'm1.s.turns')!.payoffs['a2|b1'] = ['2', '3'];
    });
    expect(has(issues, 'sequential', /m1\.s\.turns/)).toBe(true);
  });
});

describe('corrective pass: conclusion leakage', () => {
  it('matches plain-language dominance conclusions', () => {
    for (const t of ['Left is better for you either way.', 'It suits you better whichever way she goes.', 'Rice is always better whatever he does.', 'Baking early is better for you whatever happens.'])
      expect(findConclusions(t, dom), t).not.toEqual([]);
  });
  it('allows ordinary payoff comparisons and M2 "either way" comparisons', () => {
    for (const t of ['A simple dinner is fine either way, a little better if he is late.', 'The bus is cheaper and quicker for you than driving.', 'Is one of your choices better whatever they do?'])
      expect(findConclusions(t, dom), t).toEqual([]);
  });
  it('flags a leak in an undisclosed practice skin and in a held-out skin', () => {
    const issues = run((b, h) => {
      skin(b, 'sk.m1.dial').incentives['m1.s.turns'] = 'Left is better for you whichever way the dial turns.';
      h.skins.find((k) => k.id === 'hk.m3.grant')!.incentives['h.s.m3a'] = 'The template is better for you either way.';
    });
    expect(has(issues, 'gating', /sk\.m1\.dial.*asserts the conclusion/)).toBe(true);
    expect(has(issues, 'gating', /hk\.m3\.grant.*asserts the conclusion/)).toBe(true);
  });
  it('answer options are claims to judge, not assertions', () => {
    expect(run().filter((i) => /optionSets/.test(i.where))).toEqual([]);
  });
});

describe('corrective pass: held-out isomorphism', () => {
  const base = g2('p', [[3, 0], [0, 2], [1, 1], [2, 3]]);
  it('detects raw, relabelled and seat-swapped duplicates', () => {
    const raw = g2('h1', [[3, 0], [0, 2], [1, 1], [2, 3]]);
    const relabel = g2('h2', [[1, 1], [2, 3], [3, 0], [0, 2]]); // rows swapped
    const swap = g2('h3', [[0, 3], [1, 1], [2, 0], [3, 2]]); // transpose + seat swap
    const hows = heldOutIsomorphisms([base], [raw, relabel, swap]).map((x) => `${x.held}:${x.how}`);
    expect(hows).toContain('h1:raw duplicate');
    expect(hows).toContain('h2:same form up to action relabelling');
    expect(hows).toContain('h3:same form after a seat swap');
  });
  it('passes a genuinely distinct form and the real held-out set', () => {
    expect(heldOutIsomorphisms([base], [g2('h4', [[3, 3], [0, 2], [2, 0], [1, 1]])])).toEqual([]);
    expect(heldOutIsomorphisms(CONTENT.structures, HELD_OUT.structures)).toEqual([]);
    expect(HELD_OUT.structures.map((s) => s.id)).not.toContain('h.s.m3b');
    expect(ordinallyIsomorphic({ A: [[1, 0], [0, 1]], B: [[1, 0], [0, 1]] }, { A: [[0, 1], [1, 0]], B: [[0, 1], [1, 0]] })).toBe(true);
  });
});

describe('corrective pass: belief and narrative consistency', () => {
  it('flags a belief on an action strictly dominated for the other player', () => {
    const issues = run((b) => {
      const s = b.structures.find((x) => x.id === 'm2.s.belief')!;
      s.payoffs['a1|b1'] = ['4', '0'];
      s.payoffs['a2|b1'] = ['1', '0'];
      s.facts = computeFacts(s, buildGame(s, {}));
    });
    expect(has(issues, 'belief', /strictly dominated/)).toBe(true);
  });
  it('flags "only when both" wording when miscoordinated payoffs differ', () => {
    const issues = run((_b, h) => {
      h.skins.find((k) => k.id === 'hk.m2.wholesale')!.incentives['h.s.m2a'] = 'Buyers come only when both of you are there.';
    });
    expect(has(issues, 'narrative', /hk\.m2\.wholesale/)).toBe(true);
  });
});

describe('corrective pass: family validation', () => {
  it('stores a stable non-learner-facing family code that matches the engine', () => {
    expect(familyCode('prisoners_dilemma')).toBe('pd');
    expect(familyCode('battle_of_the_sexes')).toBe('bots');
    for (const s of CONTENT.structures.filter((x) => Object.keys(x.params).length === 0)) expect(s.facts.familyCode, s.id).toBe(computeFacts(s, buildGame(s, {})).familyCode);
  });
  it('flags a declared family that differs from the engine', () => {
    const issues = run((b) => {
      b.structures.find((s) => s.id === 'm1.s.meet')!.facts.familyCode = 'pd';
    });
    expect(has(issues, 'engine-facts', /m1\.s\.meet.*familyCode/)).toBe(true);
  });
});

describe('corrective pass: mirrors', () => {
  it('has exactly one purposeful seat-rotation mirror, excluded from counts', () => {
    const mirrors = CONTENT.skins.filter((k) => k.mirrorOf);
    expect(mirrors.map((k) => k.id)).toEqual(['sk.m3.picnic.b']);
    expect(mirrors[0]!.mirrorPurpose).toMatch(/purpose|predict/);
    const all = CONTENT.skins.filter((k) => k.structures.includes('m3.s.one')).length;
    expect(skinCounts(CONTENT.skins)['m3.s.one']).toBe(all - 1);
  });
  it('flags a mirror without purpose, in the same seat, or of a missing skin', () => {
    const issues = run((b) => {
      delete skin(b, 'sk.m3.picnic.b').mirrorPurpose;
      skin(b, 'sk.m3.cart').mirrorOf = 'sk.m3.nope';
      skin(b, 'sk.m3.t.tutor').mirrorOf = 'sk.m3.cart';
      skin(b, 'sk.m3.t.tutor').mirrorPurpose = 'x';
    });
    expect(has(issues, 'mirror', /picnic\.b.*purpose/)).toBe(true);
    expect(has(issues, 'mirror', /cart.*not a skin/)).toBe(true);
    expect(has(issues, 'mirror', /tutor.*(other seat|mirror of a mirror)/)).toBe(true);
    expect(item(b0(), 'i.m3.one.them').skins).toContain('sk.m3.picnic.b');
  });
});
const b0 = () => CONTENT;

describe('corrective pass: roommate dual role', () => {
  const legacy = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/roommate-kitchen.legacy.json'), 'utf8'));
  it('first experience stays byte-identical, with the full best-response definition', () => {
    expect(JSON.stringify(composeSliceScenario())).toBe(JSON.stringify(legacy));
    expect((composeSliceScenario().feedback as Record<string, string>).bestReplyDefinition).toMatch(/A best response is the action/);
  });
  it('M3.1 composition: recall line, engine best-response recap, no duplicate definition, nothing else changed', () => {
    const m31 = composeSliceM31();
    const fb = m31.feedback as Record<string, string>;
    expect(fb.bestReplyDefinition).toBe(M31_RECALL);
    expect(M31_RECALL).toBe('Again, compare your choices within B’s choice.');
    expect(bestResponseRecap()).toBe('Leave it is your best response to Clean and also to Leave it.');
    expect(fb.dominantWhy).toBe('{lines} Leave it is your best response to Clean and also to Leave it.');
    expect(fb.dominantWhy).not.toMatch(/no matter/);
    const { feedback: _a, ...rest } = m31;
    const { feedback: _b, ...first } = composeSliceScenario();
    expect(rest).toEqual(first);
    for (const k of Object.keys(ROOMMATE_SLICE.feedback)) if (!['bestReplyDefinition', 'dominantWhy'].includes(k)) expect(fb[k]).toBe(ROOMMATE_SLICE.feedback[k]);
  });
});
