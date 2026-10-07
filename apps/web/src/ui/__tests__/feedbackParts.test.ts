import { describe, expect, it } from 'vitest';
import { FIRST_SCENARIO as S } from '../../content';
import { questionFeedback, questionOptions } from '../../slice/engineFacts';
import { feedbackParts, statusLabel } from '../feedbackParts';

describe('feedbackParts (presentation only)', () => {
  it('headline is the authored text; Why is the authored why text', () => {
    const p = feedbackParts('Leave it gives you 5; Clean gives you 3. Leave it is your best response.', 'A best response is …');
    expect(p.headline).toBe('Leave it gives you 5; Clean gives you 3. Leave it is your best response.');
    expect(p.why).toBe('A best response is …');
    expect(p.hasMore).toBe(true);
  });

  it('strips a leading status word (legacy templates); no Why when none authored', () => {
    const p = feedbackParts('Not quite. Leave it gives you 1; Clean gives you 0.');
    expect(p).toEqual({ headline: 'Leave it gives you 1; Clean gives you 0.', why: '', hasMore: false });
  });

  it('every scenario feedback is evidence-first and never leads with a status word', () => {
    for (const q of S.questions) {
      for (const o of questionOptions(S, q)) {
        const fb = questionFeedback(S, q, o.id);
        const p = feedbackParts(fb.text, fb.why);
        expect(p.headline).toBe(fb.text);
        expect(p.headline).not.toMatch(/^(Yes|Right|Correct|Not quite|Great)\b/i);
        expect(p.headline).not.toMatch(/great job|well done|!/i);
      }
    }
    expect(statusLabel(true)).toBe('✓ Correct');
    expect(statusLabel(false)).toBe('Not quite');
  });
});
