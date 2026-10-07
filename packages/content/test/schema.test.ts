import { describe, expect, it } from 'vitest';
import { CONTENT, HELD_OUT, formatIssues, validateContent } from '../src/index.ts';
import { has, item, run, skin, sliceGated } from './helpers.ts';

describe('schema, ids and references', () => {
  it('real content is clean', () => {
    expect(formatIssues(validateContent(CONTENT, { extraTexts: sliceGated(), heldOut: HELD_OUT }))).toBe('');
  });
  it('flags missing required fields (malformed item and skin)', () => {
    const issues = run((b) => {
      delete (item(b, 'i.m1.players') as Partial<typeof b.items[number]>).prompt;
      (skin(b, 'sk.m1.lunch') as { situation?: string }).situation = '';
    });
    expect(has(issues, 'required', /i\.m1\.players.*"prompt"/)).toBe(true);
    expect(has(issues, 'required', /sk\.m1\.lunch.*"situation"/)).toBe(true);
  });
  it('flags duplicate ids', () => {
    const issues = run((b) => {
      b.items.push({ ...item(b, 'i.m1.actions') });
      b.skins.push({ ...skin(b, 'sk.m1.van') });
    });
    expect(has(issues, 'unique-id', /item:i\.m1\.actions/)).toBe(true);
    expect(has(issues, 'unique-id', /skin:sk\.m1\.van/)).toBe(true);
  });
  it('flags invalid references', () => {
    const issues = run((b) => {
      item(b, 'i.m1.first').skins.push('sk.nope');
      item(b, 'i.m2.br.apart').structure = 'm9.s.none';
      item(b, 'i.m1.ranking').lesson = 'm9.l9';
      b.curriculum.modules[0]!.lessons[0]!.requires.push('no_such_concept');
      skin(b, 'sk.m1.dial').structures.push('m9.s.none');
    });
    expect(has(issues, 'reference', /unknown skin "sk\.nope"/)).toBe(true);
    expect(has(issues, 'reference', /unknown structure "m9\.s\.none"/)).toBe(true);
    expect(has(issues, 'reference', /unknown lesson "m9\.l9"/)).toBe(true);
    expect(has(issues, 'reference', /unknown concept "no_such_concept"/)).toBe(true);
  });
  it('flags a skin that does not label every action or cover the item seat', () => {
    const issues = run((b) => {
      delete skin(b, 'sk.m2.juice').actionLabels.b2;
      item(b, 'i.m3.one.them').skins.push('sk.m3.bakery.a');
    });
    expect(has(issues, 'reference', /sk\.m2\.juice.*no label for action "b2"/)).toBe(true);
    expect(has(issues, 'reference', /sk\.m3\.bakery\.a has no story for seat B/)).toBe(true);
  });
  it('flags a domain outside the allowed list (structural banned-domain check)', () => {
    const issues = run((b) => {
      (skin(b, 'sk.m1.cricket') as { domain: string }).domain = 'current_affairs';
    });
    expect(has(issues, 'domain', /sk\.m1\.cricket/)).toBe(true);
  });
  it('flags undefined error codes and missing feedback coverage', () => {
    const issues = run((b) => {
      item(b, 'i.m1.first').optionSets![0]![1]!.code = 'MADE_UP';
      b.feedback = b.feedback.filter((k) => !(k.concept === 'actions' && k.code === 'MODEL_MISSING_ACTION'));
    });
    expect(has(issues, 'reference', /undefined error code "MADE_UP"/)).toBe(true);
    expect(has(issues, 'feedback-coverage', /\(actions, reason_choice, MODEL_MISSING_ACTION\)/)).toBe(true);
  });
  it('rubrics: 3–5 criteria with meet and miss examples; self-assessment weight 0', () => {
    const issues = run((b) => {
      b.rubrics[0]!.criteria = b.rubrics[0]!.criteria.slice(0, 2);
      (b.rubrics[1] as { selfAssessmentWeight: number }).selfAssessmentWeight = 0.5;
    });
    expect(has(issues, 'rubric', /needs 3–5 criteria/)).toBe(true);
    expect(has(issues, 'rubric', /never raise Understanding/)).toBe(true);
  });
});
