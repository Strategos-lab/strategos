import { describe, expect, it } from 'vitest';
import { FIRST_SCENARIO as S } from '../../content';
import { questionFeedback, questionOptions } from '../../slice/engineFacts';
import { feedbackParts, statusLabel } from '../feedbackParts';

describe('feedbackParts (presentation only)', () => {
  it('uses the first evidence statement as headline; later text is Why', () => {
    const p = feedbackParts(
      'Leave it gives you 1; Clean gives you 0. Because B chose Leave it, Leave it is your best response.',
    );
    expect(p.headline).toBe('Leave it gives you 1; Clean gives you 0.');
    expect(p.why).toContain('best response');
    expect(p.hasMore).toBe(true);
    expect(p.full).toMatch(/^Leave it gives you 1/);
  });

  it('strips a leading status word when present (legacy templates)', () => {
    const p = feedbackParts('Not quite. Leave it gives you 1; Clean gives you 0. So Leave it is better for you.');
    expect(p.headline).toBe('Leave it gives you 1; Clean gives you 0.');
    expect(p.why).toBe('So Leave it is better for you.');
    expect(p.hasMore).toBe(true);
  });

  it('a single evidence statement needs no Why disclosure', () => {
    const p = feedbackParts('Leave it gives you 5; Clean gives you 3.');
    expect(p).toEqual({
      headline: 'Leave it gives you 5; Clean gives you 3.',
      why: '',
      full: 'Leave it gives you 5; Clean gives you 3.',
      hasMore: false,
    });
  });

  it('never loses authored text for any question/answer in the scenario', () => {
    for (const q of S.questions) {
      for (const o of questionOptions(S, q)) {
        const fb = questionFeedback(S, q, o.id);
        const p = feedbackParts(fb.text);
        expect(p.full).toBe(fb.text);
        expect(fb.text.startsWith(p.headline)).toBe(true);
        expect(p.headline.length).toBeGreaterThan(0);
        // Evidence precedes conclusion: headline is not a Correct/Not-quite lead-in.
        expect(p.headline).not.toMatch(/^(Yes|Right|Correct|Not quite)\b/i);
      }
    }
    expect(statusLabel(true)).toBe('✓ Correct');
    expect(statusLabel(false)).toBe('Not quite');
  });
});
