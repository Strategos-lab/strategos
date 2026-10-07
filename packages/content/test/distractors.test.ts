import { describe, expect, it } from 'vitest';
import { CONTENT, HELD_OUT, allInstances, assessOwnWords, diagnose, evaluateClaim, feedbackFor, generateInstance, makeLookup } from '../src/index.ts';
import { has, item, run } from './helpers.ts';

const look = makeLookup(CONTENT);
const get = (id: string) => CONTENT.items.find((i) => i.id === id)!;

describe('distractors, diagnosis and feedback', () => {
  it('every option set has exactly one engine-correct option in every instance', () => {
    const lookAll = makeLookup({ structures: [...CONTENT.structures, ...HELD_OUT.structures], skins: [...CONTENT.skins, ...HELD_OUT.skins], variations: [...CONTENT.variations, ...HELD_OUT.variations] });
    let checked = 0;
    for (const it of [...CONTENT.items, ...HELD_OUT.items]) {
      for (const inst of allInstances(it, lookAll)) {
        for (const set of it.optionSets ?? []) {
          expect(set.filter((o) => evaluateClaim(o.claim, inst)).length, `${it.id} ${inst.skin.id}`).toBe(1);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
  it('flags a distractor that is accidentally correct (engine-verified)', () => {
    const issues = run((b) => {
      const o = item(b, 'i.m2.br.match').optionSets![0]![1]!;
      o.claim = { t: 'br', who: 'you', against: 'b2', action: 'a2' };
    });
    expect(has(issues, 'distractor-engine', /i\.m2\.br\.match.*engine finds 2/)).toBe(true);
  });
  it('flags a distractor of very different length and a known-wrong value equal to the answer', () => {
    const issues = run((b) => {
      item(b, 'i.m1.first').optionSets![0]![2]!.text = 'Nobody does, because you both choose at once and nobody watches anybody at all, ever.';
      item(b, 'i.m1.payoff').slots![0]!.knownWrong.push({ value: { k: 'payoff', who: 'you', profile: ['a1', 'b1'] }, code: 'ACROSS_NOT_WITHIN' });
    });
    expect(has(issues, 'distractor-form', /i\.m1\.first.*outside ±30%/)).toBe(true);
    expect(has(issues, 'distractor-engine', /i\.m1\.payoff.*equals the correct value/)).toBe(true);
  });
  it('flags fewer than two parallel option sets', () => {
    expect(has(run((b) => { item(b, 'i.m3.weak').optionSets!.pop(); }), 'distractor', /two parallel option sets/)).toBe(true);
  });
  it('diagnoses choices and fill-ins deterministically', () => {
    const inst = allInstances(get('i.m2.br.fill'), look)[0]!;
    expect(diagnose(inst, { type: 'fill_in', values: { s1: '1', s2: '4', s3: '2' } })).toEqual({ correct: true, code: 'CORRECT' });
    expect(diagnose(inst, { type: 'fill_in', values: { s1: '2', s2: '4', s3: '2' } }).code).toBe('MISREAD_PAYOFF_OWNER');
    expect(diagnose(inst, { type: 'fill_in', values: { s1: '4', s2: '4', s3: '2' } }).code).toBe('ACROSS_NOT_WITHIN');
    expect(diagnose(inst, { type: 'fill_in', values: { s1: '9', s2: '4', s3: '2' } }).code).toBe('UNMATCHED');
    const b = allInstances(get('i.m2.belief'), look).find((i) => i.variation.id === 'v.m2.belief.30')!;
    expect(diagnose(b, { type: 'reason_choice', set: 0, option: 1 }).correct).toBe(true);
    expect(diagnose(b, { type: 'reason_choice', set: 0, option: 0 }).code).toBe('NOT_BR_TO_OWN_PREDICTION');
  });
  it('feedback is evidence-first, engine-filled, seed-deterministic, and names the term only when disclosed', () => {
    const inst = allInstances(get('i.m2.belief'), look).find((i) => i.variation.id === 'v.m2.belief.70')!;
    const d = diagnose(inst, { type: 'reason_choice', set: 0, option: 0 });
    const f1 = feedbackFor(inst, d, CONTENT.feedback, 123, false);
    expect(f1).toEqual(feedbackFor(inst, d, CONTENT.feedback, 123, false));
    expect(f1.status).toBe('correct');
    expect(f1.body).toMatch(/2\.8/);
    expect(f1.body).toMatch(/1\.3/);
    expect(f1.term).toBeUndefined();
    expect(feedbackFor(inst, d, CONTENT.feedback, 123, true).term).toMatch(/expected payoff/);
  });
  it('flags a feedback phrasing that opens with a verdict or carries no evidence', () => {
    const issues = run((b) => {
      b.feedback[0]!.phrasings[0] = 'Correct! Well, that is it.';
    });
    expect(has(issues, 'evidence-first', /starts with a verdict/)).toBe(true);
    expect(has(issues, 'evidence-first', /no engine evidence slot/)).toBe(true);
  });
  it('self-assessment never raises Understanding', () => {
    for (const r of CONTENT.rubrics) {
      expect(assessOwnWords(r, { claimedMet: r.criteria.map((c) => c.id) }).understandingDelta).toBe(0);
    }
  });
  it('instances are deterministic from the seed and carry opaque ids', () => {
    const it = get('i.m3.dom.reason');
    expect(generateInstance(it, 42, look).id).toBe(generateInstance(it, 42, look).id);
    const ids = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => generateInstance(it, s, look).id));
    expect(ids.size).toBeGreaterThan(1);
    for (const id of ids) expect(id).toMatch(/^x[0-9a-z]+$/);
  });
});
