import { describe, expect, it } from 'vitest';
import { FIRST_SCENARIO as S } from '../../content';
import { questionFeedback, questionOptions } from '../../slice/engineFacts';
import { feedbackParts, statusLabel } from '../feedbackParts';

describe('feedbackParts (presentation only)', () => {
  it('uses the concluding statement as headline and keeps the full authored text', () => {
    const p = feedbackParts('Not quite. If Roommate B chooses Leave it: Leave it gives you 1, Clean gives you 0. So Leave it is better for you.');
    expect(p.headline).toBe('So Leave it is better for you.');
    expect(p.hasMore).toBe(true);
    expect(p.full).toMatch(/^Not quite\. If Roommate B/);
  });

  it('a single statement after the status word needs no Why disclosure', () => {
    const p = feedbackParts('Yes. If Roommate B chooses Clean: Leave it gives you 5, Clean gives you 3.');
    expect(p).toEqual({
      headline: 'If Roommate B chooses Clean: Leave it gives you 5, Clean gives you 3.',
      full: 'Yes. If Roommate B chooses Clean: Leave it gives you 5, Clean gives you 3.',
      hasMore: false,
    });
  });

  it('never loses authored text for any question/answer in the scenario', () => {
    for (const q of S.questions) {
      for (const o of questionOptions(S, q)) {
        const fb = questionFeedback(S, q, o.id);
        const p = feedbackParts(fb.text);
        expect(p.full).toBe(fb.text);
        expect(fb.text.endsWith(p.headline)).toBe(true);
        expect(p.headline.length).toBeGreaterThan(0);
      }
    }
    expect(statusLabel(true)).toBe('✓ Correct');
    expect(statusLabel(false)).toBe('Not quite');
  });
});
