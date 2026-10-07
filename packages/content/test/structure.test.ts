import { describe, expect, it } from 'vitest';
import { CONTENT, HELD_OUT, buildGame, computeFacts, paramCombos, structureFamily } from '../src/index.ts';
import { has, run } from './helpers.ts';

describe('Structure × Skin × Variation', () => {
  it('declared structural facts match the engine for every parameter combination', () => {
    for (const s of [...CONTENT.structures, ...HELD_OUT.structures]) {
      const combos = paramCombos(s);
      expect(combos.length, s.id).toBeGreaterThan(0);
      for (const c of combos) expect(computeFacts(s, buildGame(s, c)), `${s.id} ${JSON.stringify(c)}`).toEqual(s.facts);
    }
  });
  it('flags a declared fact the engine contradicts', () => {
    const issues = run((b) => {
      b.structures.find((s) => s.id === 'm2.s.match')!.facts.strictlyDominant.A = 'a1';
      b.structures.find((s) => s.id === 'm3.s.one')!.payoffs['a2|b2'] = ['3', '1'];
    });
    expect(has(issues, 'engine-facts', /m2\.s\.match.*strictlyDominant/)).toBe(true);
    expect(has(issues, 'engine-facts', /m3\.s\.one/)).toBe(true);
  });
  it('flags a variation outside the parameter space, and an undeclared structure change', () => {
    const issues = run((b) => {
      b.variations.find((v) => v.id === 'v.m2.match.hi')!.params = { H: 1, L: 2 };
      b.variations.find((v) => v.id === 'v.m3.weak')!.purpose = 'change';
    });
    expect(has(issues, 'variation', /v\.m2\.match\.hi.*not an allowed combination/)).toBe(true);
    expect(has(issues, 'variation', /v\.m3\.weak.*must declare facts and changeReason/)).toBe(true);
  });
  it('M2 and M3 include structures with no dominant action (contrast), and M3 one-sided and IESDS cases', () => {
    const f = (id: string) => CONTENT.structures.find((s) => s.id === id)!.facts;
    for (const id of ['m2.s.match', 'm2.s.apart', 'm2.s.three', 'm2.s.belief']) expect(f(id).strictlyDominant).toEqual({ A: null, B: null });
    expect(structureFamily(CONTENT.structures.find((s) => s.id === 'm2.s.match')!)).toBe('pure_coordination');
    expect(JSON.stringify(CONTENT.structures)).not.toMatch(/"family"/);
    expect(f('m3.s.one').strictlyDominant).toEqual({ A: 'a1', B: null });
    expect(f('m3.s.elim').strictlyDominant).toEqual({ A: null, B: null });
    expect(f('m3.s.elim').iesdsSolution).toEqual(['a1', 'b2']);
    expect(f('m3.s.weak').weaklyDominantOnly.A).toBe('a1');
    expect(f('m3.s.roommate').strictlyDominant).toEqual({ A: 'leave', B: 'leave' });
    expect(CONTENT.items.some((i) => i.structure === 'm2.s.match' && i.lesson.startsWith('m3'))).toBe(true);
  });
  it('meets the Phase 2 coverage target: ≥ 3 structures × ≥ 4 practice skins per module, ≥ 6 domains', () => {
    for (const m of [1, 2, 3]) {
      const structs = CONTENT.structures.filter((s) => s.module === m && s.id !== 'm3.s.roommate');
      const practice = CONTENT.items.filter((i) => i.lesson.startsWith(`m${m}.`) && i.role !== 'transfer');
      const covered = structs.filter((s) => new Set(practice.filter((i) => i.structure === s.id).flatMap((i) => i.skins)).size >= 4);
      expect(covered.length, `module ${m}`).toBeGreaterThanOrEqual(3);
      const domains = new Set(CONTENT.items.filter((i) => i.lesson.startsWith(`m${m}.`)).flatMap((i) => i.skins).map((k) => CONTENT.skins.find((s) => s.id === k)!.domain));
      expect(domains.size, `module ${m} domains`).toBeGreaterThanOrEqual(6);
    }
  });
  it('seat rotation: the one-sided structure is taught from both seats', () => {
    const seats = new Set(CONTENT.items.filter((i) => i.structure === 'm3.s.one').map((i) => i.seat));
    expect([...seats].sort()).toEqual(['A', 'B']);
  });
  it('transfer items use new stories that are not cosmetic swaps', () => {
    const issues = run((b) => {
      const t = b.items.find((i) => i.id === 'i.m1.t.players')!;
      const copy = { ...b.skins.find((s) => s.id === 'sk.m1.lunch')!, id: 'sk.m1.t.copy' };
      copy.roles = { ...copy.roles, other: { id: 'x', label: 'Mina', short: 'Mina' } };
      b.skins.push(copy);
      t.skins = ['sk.m1.t.copy'];
      b.items.find((i) => i.id === 'i.m1.t.timing')!.skins = ['sk.m1.dinner'];
    });
    expect(has(issues, 'transfer', /sk\.m1\.t\.copy is a near-duplicate of practice skin sk\.m1\.lunch/)).toBe(true);
    expect(has(issues, 'transfer', /skin sk\.m1\.dinner is also used in practice/)).toBe(true);
  });
});
