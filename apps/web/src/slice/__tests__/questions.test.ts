import { describe, expect, it } from 'vitest';
import { bestResponseTable, bestResponses, dominance, internalConsistency } from '@strategos/engine';
import { FIRST_SCENARIO as S, type Scenario } from '../../content';
import {
  NONE_OPTION,
  closingNote,
  comparisonLine,
  correctOptions,
  decisionConsistency,
  questionFeedback,
  questionOptions,
} from '../engineFacts';
import { feedbackParts } from '../../ui/feedbackParts';

const ids = S.game.players[0]!.actions.map((a) => a.id);
const q = (id: string) => S.questions.find((x) => x.id === id)!;

describe('structured questions are engine-checked', () => {
  it('best-reply answers match engine best responses for each B choice', () => {
    for (const [qid, j] of [
      ['if-b-cleans', 0],
      ['if-b-leaves', 1],
    ] as const) {
      expect(correctOptions(S, q(qid))).toEqual(bestResponses(S.game, 0, j).map((i) => ids[i]));
    }
    expect(correctOptions(S, q('if-b-cleans'))).toEqual(['leave']);
    expect(correctOptions(S, q('if-b-leaves'))).toEqual(['leave']);
  });

  it('feedback is evidence-first with engine payoff comparisons', () => {
    const table = bestResponseTable(S.game, 0);
    expect(table[0]!.payoffs.map(String)).toEqual(['3', '5']);
    expect(table[1]!.payoffs.map(String)).toEqual(['0', '1']);
    expect(comparisonLine(S, 0)).toBe('Leave it gives you 5; Clean gives you 3.');
    expect(comparisonLine(S, 1)).toBe('Leave it gives you 1; Clean gives you 0.');
    const right = questionFeedback(S, q('if-b-cleans'), 'leave');
    expect(right.correct).toBe(true);
    expect(right.text).not.toMatch(/^(Yes|Right|Correct|Not quite)\b/i);
    const parts = feedbackParts(right.text);
    expect(right.text).toBe('Leave it gives you 5; Clean gives you 3. Leave it is your best response.');
    expect(right.why).toBe('A best response is the action that gives you the highest payoff given the other player’s choice.');
    expect(parts.headline).toBe(right.text);
    const wrong = questionFeedback(S, q('if-b-leaves'), 'clean');
    expect(wrong.correct).toBe(false);
    // Q2: evidence + concept, no repeated definition (correct and wrong answers alike).
    expect(wrong.text).toBe('Leave it gives you 1; Clean gives you 0. So Leave it is again your best response.');
    expect(wrong.why).toBe('');
    expect(questionFeedback(S, q('if-b-leaves'), 'leave').why).toBe('');
    expect(questionFeedback(S, q('if-b-cleans'), 'clean').why).toContain('A best response is');
  });

  it('Q3 options and dominant-strategy feedback match the engine', () => {
    const d = dominance(S.game, 0).strictlyDominantAction;
    expect(d).toBe(1);
    expect(correctOptions(S, q('either-way'))).toEqual([ids[d!]]);
    expect(questionOptions(S, q('either-way')).map((o) => o.label)).toEqual([
      'Clean is always better.',
      'Leave it is always better.',
      'It depends on what B chooses.',
    ]);
    const fb = questionFeedback(S, q('either-way'), NONE_OPTION);
    expect(fb.correct).toBe(false);
    expect(fb.text).toBe('Leave it is better in both comparisons. That makes Leave it a dominant strategy.');
    expect(fb.why).toBe(
      'If B chooses Clean: Leave it gives you 5; Clean gives you 3. If B chooses Leave it: Leave it gives you 1; Clean gives you 0. A dominant strategy gives you a higher payoff no matter what the other player does.',
    );
    expect(fb.text).not.toMatch(/nash|equilibri|dilemma/i);
  });

  it('every template is fully populated (no leftover placeholders)', () => {
    for (const question of S.questions) {
      for (const o of questionOptions(S, question)) {
        expect(questionFeedback(S, question, o.id).text).not.toMatch(/[{}]/);
        expect(questionFeedback(S, question, o.id).why).not.toMatch(/[{}]/);
      }
    }
    expect(closingNote(S)).toBe(
      'If both choose the individually higher-payoff action, they reach (1, 1), even though (3, 3) would make both better off.',
    );
  });

  it('answers follow the engine when the payoffs change (nothing hard-coded)', () => {
    const coord: Scenario = { ...S, game: { ...S.game, payoffs: [[['4', '4'], ['0', '3']], [['3', '0'], ['2', '2']]] } };
    expect(correctOptions(coord, q('if-b-cleans'))).toEqual(['clean']);
    expect(correctOptions(coord, q('if-b-leaves'))).toEqual(['leave']);
    expect(correctOptions(coord, q('either-way'))).toEqual([NONE_OPTION]);
    expect(questionFeedback(coord, q('either-way'), NONE_OPTION).text).toContain('depends on what B does');
    expect(questionFeedback(coord, q('either-way'), 'clean').text).toContain('it depends on B');
    expect(closingNote(coord)).toBeNull();
    const tie: Scenario = { ...S, game: { ...S.game, payoffs: [[['2', '3'], ['0', '5']], [['2', '0'], ['1', '1']]] } };
    expect(correctOptions(tie, q('if-b-cleans'))).toEqual(['clean', 'leave']);
    expect(questionFeedback(tie, q('if-b-cleans'), 'clean').text).toContain('equally good');
  });

  it('decision consistency is judged against the learner’s own prediction via the engine', () => {
    for (const prediction of [0, 1]) {
      for (const conf of [50, 75, 100]) {
        for (const choice of [0, 1]) {
          const fact = decisionConsistency(S, prediction, conf, choice);
          const ic = internalConsistency(S.game, 0, fact.belief, choice);
          expect(fact.consistent).toBe(ic.consistent);
          expect(fact.consistent).toBe(choice === 1);
        }
      }
    }
    expect(decisionConsistency(S, 1, 70, 0).belief).toEqual(['3/10', '7/10']);
  });
});
