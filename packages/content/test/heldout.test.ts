import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT, HELD_OUT } from '../src/index.ts';
import { has, run } from './helpers.ts';

const root = join(import.meta.dirname, '..');

describe('provisional held-out set', () => {
  it('is flagged provisional, in three balanced parallel forms, 6–8 items per module', () => {
    expect(HELD_OUT.provisional).toBe(true);
    const forms = ['A', 'B', 'C'].map((f) => HELD_OUT.items.filter((i) => i.heldOutForm === f).length);
    expect(Math.max(...forms) - Math.min(...forms)).toBeLessThanOrEqual(1);
    for (const m of ['m1', 'm2', 'm3']) {
      const n = HELD_OUT.items.filter((i) => i.lesson.startsWith(`${m}.`)).length;
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(8);
    }
    for (const i of HELD_OUT.items) expect(i.role).toBe('held_out');
  });
  it('shares no ids, structures, stories or (structure, skin) pairs with practice', () => {
    const prac = new Set([...CONTENT.structures, ...CONTENT.skins, ...CONTENT.variations, ...CONTENT.items].map((x) => x.id));
    for (const x of [...HELD_OUT.structures, ...HELD_OUT.skins, ...HELD_OUT.variations, ...HELD_OUT.items]) expect(prac.has(x.id), x.id).toBe(false);
    const pairs = new Set(CONTENT.items.flatMap((i) => i.skins.map((k) => `${i.structure}|${k}`)));
    for (const i of HELD_OUT.items) for (const k of i.skins) expect(pairs.has(`${i.structure}|${k}`)).toBe(false);
  });
  it('flags overlapping ids, practice use of held-out content, repeated payoffs and near-duplicate text', () => {
    const issues = run((b, h) => {
      h.items[0]!.id = 'i.m1.players';
      b.items.find((i) => i.id === 'i.m1.first')!.skins.push('hk.m1.sign');
      h.structures[0]!.payoffs = { ...b.structures.find((s) => s.id === 'm1.s.meet')!.payoffs };
      h.structures[0]!.facts = b.structures.find((s) => s.id === 'm1.s.meet')!.facts;
      h.skins[1]!.situation = b.skins.find((s) => s.id === 'sk.m1.draft')!.situation;
      h.skins[1]!.incentives = { 'h.s.m1a': b.skins.find((s) => s.id === 'sk.m1.draft')!.incentives['m1.s.meet']! };
    });
    expect(has(issues, 'held-out', /item:i\.m1\.players id overlaps the practice set/)).toBe(true);
    expect(has(issues, 'held-out', /practice item uses held-out hk\.m1\.sign/)).toBe(true);
    expect(has(issues, 'held-out', /isomorphic to practised m1\.s\.meet .*raw duplicate/)).toBe(true);
    expect(has(issues, 'held-out', /hk\.m1\.slot near-duplicate of sk\.m1\.draft/)).toBe(true);
  });
  it('flags unbalanced forms and a parallel form of a different concept', () => {
    const issues = run((_b, h) => {
      h.items[0]!.heldOutForm = 'B';
      h.items[1]!.heldOutForm = 'B';
      h.items[2]!.parallelOf = 'i.m2.belief';
    });
    expect(has(issues, 'held-out', /unbalanced/)).toBe(true);
    expect(has(issues, 'held-out', /same concept with the same item type/)).toBe(true);
  });
  it('is never reachable from the slice entry or the web app (not bundled, not practised)', () => {
    const slice = readFileSync(join(root, 'src/slice.ts'), 'utf8');
    expect(slice).not.toMatch(/from ['"][^'"]*(held-out|modules\/)/);
    const webSrc = join(root, '../../apps/web/src');
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    // App code (not tests) may import only the slice entry, never the full bundle or held-out data.
    for (const f of walk(webSrc).filter((x) => /\.(ts|tsx)$/.test(x) && !/\.test\.tsx?$/.test(x))) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).not.toMatch(/from ['"]@strategos\/content['"]|from ['"][^'"]*held-out|HELD_OUT/);
    }
    expect(readFileSync(join(webSrc, 'content/index.ts'), 'utf8')).toMatch(/from '@strategos\/content\/slice'/);
  });
});
