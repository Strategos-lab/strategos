import { describe, expect, it } from 'vitest';
import {
  CONTENT, HELD_OUT, allInstances, bestResponseRecap, claimAnswer, contentCounts, evaluateClaim, heldOutAnswerShortcuts, heldOutAnswers,
  makeLookup, render, validateScenarioItems, ROOMMATE_SLICE, heldOutDistribution, heldOutIsomorphisms, sliceStructure, type Claim, type Issue,
} from '../src/index.ts';
import { clone, has, run } from './helpers.ts';

const look = makeLookup({ ...CONTENT, structures: [...CONTENT.structures], skins: [...CONTENT.skins], variations: [...CONTENT.variations] } as never);
const inst = (itemId: string) => allInstances(CONTENT.items.find((i) => i.id === itemId)!, look)[0]!;

describe('Pass B: held-out answer shortcuts', () => {
  it('the held-out set has no shortcut issues', () => expect(heldOutAnswerShortcuts(HELD_OUT)).toEqual([]));
  it('h.s.m2b belief items give at least two different correct actions across A/B/C', () => {
    const rows = heldOutAnswers(HELD_OUT).filter((r) => r.group === 'i.m2.belief');
    expect(rows.map((r) => r.form).sort()).toEqual(['A', 'B', 'C']);
    expect(new Set(rows.flatMap((r) => r.answers)).size).toBeGreaterThanOrEqual(2);
  });
  it('correct positions vary within every parallel group of two or more', () => {
    const g = new Map<string, Set<number>>();
    for (const r of heldOutAnswers(HELD_OUT)) g.set(r.group, new Set([...(g.get(r.group) ?? []), ...r.positions]));
    const multi = [...g].filter(([k]) => heldOutAnswers(HELD_OUT).filter((r) => r.group === k).length > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const [k, s] of multi) expect(s.size, k).toBeGreaterThan(1);
  });
  it('flags a fixed answer position across forms', () => {
    const issues = run((_b, h) => {
      for (const i of h.items.filter((x) => x.parallelOf === 'i.m3.contrast.both')) i.optionSets = clone(h.items.find((x) => x.id === 'h.m3.dom.a')!.optionSets);
      for (const i of h.items.filter((x) => x.parallelOf === 'i.m3.contrast.both' && x.structure !== 'h.s.m3a')) i.structure = 'h.s.m3a';
    });
    expect(has(issues, 'held-out-answers', /position .* in every form/)).toBe(true);
  });
  it('flags the same correct action in every form', () => {
    const issues = run((_b, h) => { h.variations.find((v) => v.id === 'hv.m2b.70')!.belief = { b1: '1/5', b2: '4/5' }; });
    expect(has(issues, 'held-out-answers', /same correct answer \(a1\)/)).toBe(true);
  });
  it('claimAnswer reads actions and profiles, not yes/no claims', () => {
    expect(claimAnswer({ t: 'br', who: 'you', against: 'b1', action: 'a2' } as Claim)).toBe('a2');
    expect(claimAnswer({ t: 'iesds', profile: ['a2', 'b3'] } as Claim)).toBe('a2|b3');
    expect(claimAnswer({ t: 'noneDominated' } as Claim)).toBeNull();
  });
});

describe('Pass B: counts and scenario items', () => {
  const c = contentCounts(CONTENT);
  it.each(['m1', 'm2', 'm3'])('%s is within the explanation and transfer targets', (m) => {
    expect(c[m]!.explanation).toBeGreaterThanOrEqual(15);
    expect(c[m]!.explanation).toBeLessThanOrEqual(25);
    expect(c[m]!.transfer).toBeGreaterThanOrEqual(4);
    expect(c[m]!.transfer).toBeLessThanOrEqual(6);
  });
  it('the three roommate questions count once toward M3.1', () => {
    expect(c.m3!.scenarioItems).toBe(3);
    const l = CONTENT.curriculum.modules.flatMap((m) => m.lessons).find((x) => x.id === 'm3.l1')!;
    expect(l.scenarioItems).toHaveLength(3);
  });
  it('flags a duplicated, foreign or unknown scenario item', () => {
    const b = clone(CONTENT);
    const l = b.curriculum.modules.flatMap((m) => m.lessons).find((x) => x.id === 'm3.l1')!;
    l.scenarioItems = [...l.scenarioItems!, l.scenarioItems![0]!, 'roommate-kitchen#nope', 'other#if-b-cleans'];
    const issues: Issue[] = [];
    validateScenarioItems(b, Object.fromEntries([[ROOMMATE_SLICE.id, ROOMMATE_SLICE.questions.map((q) => q.id)]]) as never, issues);
    expect(issues.map((i) => i.message).join('\n')).toMatch(/more than once[\s\S]*not a question[\s\S]*not from this lesson/);
  });
  it('mirrors are excluded from substantive skins', () => {
    const b = clone(CONTENT);
    const before = contentCounts(b).m3!.substantiveSkins;
    b.skins.find((k) => k.id === 'sk.m3.canal')!.mirrorOf = 'sk.m3.referrals';
    expect(contentCounts(b).m3!.substantiveSkins).toBe(before - 1);
  });
});

describe('Pass B: held-out concept coverage', () => {
  it('covers dominated strategy, IESDS, weak dominance, best response, belief and structure/timing', () => {
    const parents = new Set(HELD_OUT.items.map((i) => i.parallelOf));
    const concepts = new Set(CONTENT.items.filter((i) => parents.has(i.id)).map((i) => i.concept));
    for (const k of ['dominated_action', 'iesds', 'weak_dominance', 'best_response', 'belief_response']) expect(concepts.has(k), k).toBe(true);
    expect([...concepts].some((k) => /players|timing|information|sequen|interdepend/.test(k))).toBe(true);
  });
});

describe('Pass B: engine-derived claims and slots', () => {
  it('unobserved timing: a first mover, but no observation', () => {
    const i = inst('i.m1.unseen');
    expect(i.structure.sequence).toBe('sequential_unobserved');
    expect(evaluateClaim({ t: 'firstMover', who: 'you' } as Claim, i)).toBe(true);
    expect(evaluateClaim({ t: 'observes', who: 'them' } as Claim, i)).toBe(false);
  });
  it('brTie holds for the authored tie and not for a single action', () => {
    const i = inst('i.m2.br.tie');
    const ok = CONTENT.items.find((x) => x.id === 'i.m2.br.tie')!.optionSets![0]!.find((o) => o.claim.t === 'brTie')!.claim;
    expect(evaluateClaim(ok, i)).toBe(true);
    expect(evaluateClaim({ ...(ok as object), actions: [(ok as { actions: string[] }).actions[0]] } as Claim, i)).toBe(false);
  });
  it('the dilemma: dominant play is improvable for both', () => {
    const i = inst('i.m3.dilemma');
    expect(evaluateClaim({ t: 'domOutcomeImprovable', than: ['a1', 'b1'] } as Claim, i)).toBe(true);
    expect(evaluateClaim({ t: 'domOutcomeUnimprovable' } as Claim, i)).toBe(false);
  });
  it('IESDS stuck: not solved, and the steps slot names what goes', () => {
    const i = inst('i.m3.iesds.stuck');
    expect(evaluateClaim({ t: 'iesdsUnsolved' } as Claim, i)).toBe(true);
    expect(render('{f:steps}', i, { facts: { steps: { k: 'iesdsSteps' } } } as never)).toMatch(/, then /);
  });
  it('the weak slot refuses a strictly dominant action', () => {
    const i = inst('i.m3.three.dom');
    expect(() => render('{f:w}', i, { facts: { w: { k: 'weak', who: 'you', part: 'dom' } } } as never)).toThrow();
  });
  it('noneDominated is true on the held-out no-dominance form', () => {
    const h = makeLookup(HELD_OUT as never);
    const i = allInstances(HELD_OUT.items.find((x) => x.id === 'h.m3.dom.c')!, h)[0]!;
    expect(evaluateClaim({ t: 'noneDominated' } as Claim, i)).toBe(true);
  });
});

describe('Pass B: best-response recap', () => {
  it('is unchanged and comes from the engine table', () => {
    expect(bestResponseRecap()).toBe('Leave it is your best response to Clean and also to Leave it.');
  });
});

describe('Pass B final: dilemma structure', () => {
  const s = CONTENT.structures.find((x) => x.id === 'm3.s.rush')!;
  it('i.m3.dilemma uses its own structure; pledge keeps only the three-action dominant item', () => {
    expect(CONTENT.items.find((i) => i.id === 'i.m3.dilemma')!.structure).toBe('m3.s.rush');
    expect(CONTENT.items.filter((i) => i.structure === 'm3.s.pledge').map((i) => i.id)).toEqual(['i.m3.three.dom']);
  });
  it('both players have a strictly dominant action whose outcome is worse for both than another', () => {
    const i = inst('i.m3.dilemma');
    expect(evaluateClaim({ t: 'strictDom', who: 'you', action: 'a2' } as Claim, i)).toBe(true);
    expect(evaluateClaim({ t: 'strictDom', who: 'them', action: 'b3' } as Claim, i)).toBe(true);
    expect(evaluateClaim({ t: 'domOutcomeImprovable', than: ['a1', 'b1'] } as Claim, i)).toBe(true);
  });
  it('is not isomorphic to the roommate or pledge matrices', () => {
    const others = CONTENT.structures.filter((x) => x.id === 'm3.s.pledge' || x.id === sliceStructure().id);
    expect(others).toHaveLength(2);
    expect(heldOutIsomorphisms(others, [s])).toEqual([]);
  });
});

describe('Pass B final: tie code scope', () => {
  it('the M2 tie item uses TREATING_TIE_AS_STRICT, not WEAK_AS_STRICT', () => {
    const codes = CONTENT.items.find((i) => i.id === 'i.m2.br.tie')!.optionSets!.flat().map((o) => o.code);
    expect(codes).toContain('TREATING_TIE_AS_STRICT');
    expect(codes).not.toContain('WEAK_AS_STRICT');
    expect(CONTENT.errorCodes.some((e) => e.code === 'TREATING_TIE_AS_STRICT')).toBe(true);
  });
  it('flags WEAK_AS_STRICT outside M3 weak dominance (options and feedback)', () => {
    const issues = run((b) => {
      const o = b.items.find((i) => i.id === 'i.m2.br.tie')!.optionSets![0]!.find((x) => x.code === 'TREATING_TIE_AS_STRICT')!;
      o.code = 'WEAK_AS_STRICT';
      b.feedback.find((k) => k.code === 'TREATING_TIE_AS_STRICT')!.code = 'WEAK_AS_STRICT';
    });
    expect(has(issues, 'code-scope', /item:i\.m2\.br\.tie/)).toBe(true);
    expect(has(issues, 'code-scope', /feedback:best_response\/WEAK_AS_STRICT/)).toBe(true);
  });
});

describe('Pass B final: held-out distribution', () => {
  const rows = heldOutDistribution(HELD_OUT);
  it('within each module, no position holds more than 40% of items and no form repeats one position', () => {
    for (const m of ['m1', 'm2', 'm3']) {
      const ps = rows.filter((r) => r.module === m).map((r) => r.positions[0]);
      const max = Math.max(...[0, 1, 2, 3].map((p) => ps.filter((x) => x === p).length));
      expect(max * 5, m).toBeLessThanOrEqual(ps.length * 2);
      for (const f of ['A', 'B', 'C']) {
        const fp = rows.filter((r) => r.module === m && r.form === f).map((r) => r.positions[0]);
        if (fp.length > 1) expect(new Set(fp).size, `${m} ${f}`).toBeGreaterThan(1);
      }
    }
  });
  it('M3 action answers are spread (no a2 lean)', () => {
    const acts = rows.filter((r) => r.module === 'm3').flatMap((r) => r.answers).filter((a) => /^[ab][123]$/.test(a));
    expect(new Set(acts).size).toBe(acts.length);
  });
  it('flags a module-level position concentration', () => {
    const issues = run((_b, h) => {
      const hl = makeLookup(h as never);
      for (const i of h.items) if (i.lesson.startsWith('m2.')) {
        const x = allInstances(i, hl)[0]!;
        i.optionSets = i.optionSets!.map((st) => [...st.filter((o) => evaluateClaim(o.claim, x)), ...st.filter((o) => !evaluateClaim(o.claim, x))]);
      }
    });
    expect(has(issues, 'held-out-answers', /held-out module m2/)).toBe(true);
  });
});
