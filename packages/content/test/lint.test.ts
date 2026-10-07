import { describe, expect, it } from 'vitest';
import { lintField, similarity } from '../src/index.ts';
import { has, run, skin } from './helpers.ts';

const msgs = (kind: Parameters<typeof lintField>[1], t: string) => lintField('x', kind, t).map((i) => i.message);

describe('content lint', () => {
  it('flags motivational filler, trait language and moralising or outcome-judging words', () => {
    expect(msgs('feedback', 'Great job, {them} picks {act:a1}.')[0]).toMatch(/filler/);
    expect(msgs('feedback', 'You are a natural at {act:a1}.')[0]).toMatch(/trait/);
    for (const w of ['fair', 'unfair', 'selfish', 'lucky']) expect(msgs('situation', `That was ${w} of {them}.`).join()).toMatch(/moralising/);
  });
  it('flags colour-only meaning, US spellings and literal numbers', () => {
    expect(msgs('prompt', 'Tap the green cell.').join()).toMatch(/colour/);
    expect(msgs('prompt', 'Pick the behavior you favor.').join()).toMatch(/Indian English/);
    expect(msgs('option', 'It gives you 3.').join()).toMatch(/literal number/);
    expect(msgs('option', 'It gives you {pay:you:a1:b1}.')).toEqual([]);
  });
  it('enforces length limits and short action labels', () => {
    expect(msgs('situation', 'a'.repeat(321)).join()).toMatch(/too long/);
    expect(msgs('actionLabel', 'Go to the far side').join()).toMatch(/three words|too long/);
  });
  it('the real skins pass and an injected problem in a skin is caught', () => {
    const issues = run((b) => {
      skin(b, 'sk.m2.roads').incentives['m2.s.apart'] += ' Taking the highway is selfish.';
      skin(b, 'sk.m2.room').matrixLabel = '';
    });
    expect(has(issues, 'lint', /sk\.m2\.roads.*moralising/)).toBe(true);
    expect(has(issues, 'required', /sk\.m2\.room.*matrixLabel/)).toBe(true);
  });
  it('similarity ignores stop words and slots', () => {
    expect(similarity('You and Meera go to lunch.', 'You and Meera go to lunch.')).toBe(1);
    expect(similarity('Two juice carts at the station.', 'A badminton court booking.')).toBe(0);
  });
});
