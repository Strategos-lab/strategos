import { describe, expect, it } from 'vitest';
import { CONTENT, HELD_OUT, formatIssues, sliceTexts, validateContent } from '../src/index.ts';

export const SLICE_GATED = () => sliceTexts().map((t) => ({ lesson: 'm3.l1', ...t }));

describe('authored content', () => {
  it('passes the validator, lint, gating and held-out separation', () => {
    const issues = validateContent(CONTENT, { extraTexts: SLICE_GATED(), heldOut: HELD_OUT });
    expect(formatIssues(issues)).toBe('');
  });
});
