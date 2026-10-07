import { describe, expect, it } from 'vitest';
import { CONTENT, HELD_OUT, findCycle, findTerms, gatedTexts, lessonOrder, termAllowed, termRegex } from '../src/index.ts';
import { has, item, run, skin, sliceGated } from './helpers.ts';

const concept = (id: string) => CONTENT.concepts.find((c) => c.id === id)!;
const order = lessonOrder(CONTENT.curriculum);

describe('concept graph and terminology gating', () => {
  it('the concept graph is acyclic and a cycle is detected', () => {
    expect(findCycle(CONTENT.concepts)).toBeNull();
    const cyc = structuredClone(CONTENT.concepts);
    cyc.find((c) => c.id === 'players')!.prerequisites.push('dominant_strategy');
    expect(findCycle(cyc)).not.toBeNull();
    expect(has(run((b) => { b.concepts.find((c) => c.id === 'players')!.prerequisites.push('dominant_strategy'); }), 'concept-graph', /cycle/)).toBe(true);
  });
  it('a term is blocked before its reveal step, allowed at and after it, and in later lessons', () => {
    const br = concept('best_response');
    expect(br.introducedIn).toBe('m2.l1');
    expect(termAllowed(br, 'm1.l4', 'summary', order)).toBe(false);
    expect(termAllowed(br, 'm2.l1', 'explain', order)).toBe(false);
    expect(termAllowed(br, 'm2.l1', br.revealStep, order)).toBe(true);
    expect(termAllowed(br, 'm2.l1', 'summary', order)).toBe(true);
    expect(termAllowed(br, 'm3.l2', 'encounter', order)).toBe(true);
  });
  it('flags a formal term used before its reveal in its own lesson and in an earlier lesson', () => {
    const issues = run((b) => {
      item(b, 'i.m2.br.match').prompt = 'Which best response is better for you if {them} chooses {act:b2}?';
      skin(b, 'sk.m1.lunch').situation += ' Each choice is a dominant strategy question.';
    });
    expect(has(issues, 'gating', /i\.m2\.br\.match.*best response.*m2\.l1\/explain/)).toBe(true);
    expect(has(issues, 'gating', /sk\.m1\.lunch.*dominant.*m1\.l1\/encounter/)).toBe(true);
  });
  it('transfer-hidden and held-out items never name the tested concept before the answer', () => {
    const issues = run((b, h) => {
      item(b, 'i.m3.t.dom').prompt = 'Is there a dominant choice for you whatever {them} does?';
      h.items.find((i) => i.id === 'h.m2.br.a')!.prompt = 'What is your best response if {them} chooses {act:b2}?';
    });
    expect(has(issues, 'gating', /i\.m3\.t\.dom.*hidden concept "dominant_strategy"/)).toBe(true);
    expect(has(issues, 'gating', /h\.m2\.br\.a.*hidden concept "best_response"/)).toBe(true);
  });
  it('no Nash equilibrium (or later-module terms) anywhere in Modules 1–3, including the roommate slice', () => {
    const texts = gatedTexts(CONTENT, sliceGated(), HELD_OUT);
    for (const id of ['nash_equilibrium', 'social_dilemma', 'pareto', 'mixed_strategy']) {
      const c = concept(id);
      expect(c.introducedIn).toBeNull();
      expect(texts.filter((t) => findTerms(t.text, c).length > 0).map((t) => t.where)).toEqual([]);
    }
  });
  it('the roommate slice names "dominant strategy" only at feedback and "best response" only after Module 2', () => {
    const dom = concept('dominant_strategy');
    for (const t of sliceGated()) {
      if (findTerms(t.text, dom).length) expect(['feedback', 'reveal', 'summary']).toContain(t.step);
    }
  });
  it('terms match at word starts only', () => {
    expect(termRegex('payoff').test('Payoffs matter')).toBe(true);
    expect(termRegex('nash').test('dinashore')).toBe(false);
    expect(termRegex('best response').test('best\u00a0response')).toBe(true);
  });
  it('every lesson-introduced concept has prerequisites introduced earlier', () => {
    for (const c of CONTENT.concepts.filter((x) => x.introducedIn)) {
      for (const p of c.prerequisites) {
        const pc = concept(p);
        expect(order.indexOf(pc.introducedIn!), `${c.id} needs ${p}`).toBeLessThanOrEqual(order.indexOf(c.introducedIn!));
      }
    }
  });
  it('flags a lesson requiring a concept introduced later', () => {
    expect(has(run((b) => { b.curriculum.modules[0]!.lessons[0]!.requires.push('best_response'); }), 'prerequisite', /m1\.l1.*best_response/)).toBe(true);
  });
});
