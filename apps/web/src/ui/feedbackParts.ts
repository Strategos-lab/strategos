/**
 * Presentation-only shaping of authored feedback (no game logic): a leading status word
 * ("Yes." / "Right." / "Not quite." / "Correct.") is stripped when present, because the UI chrome
 * shows Correct / Not quite from the correctness flag. The remaining authored text is the
 * evidence-first headline; optional authored Why text sits behind a disclosure.
 */
const STATUS = /^(yes|right|correct|not quite)\.$/i;

export interface FeedbackParts {
  /** Evidence-first headline (authored text without any leading status word). */
  headline: string;
  /** Optional Why text (authored), empty when none. */
  why: string;
  /** True when there is Why text to disclose. */
  hasMore: boolean;
}

export function splitStatements(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 0);
}

export function feedbackParts(text: string, why = ''): FeedbackParts {
  const statements = splitStatements(text);
  const body = statements.length > 1 && STATUS.test(statements[0]!) ? statements.slice(1) : statements;
  const headline = body.join(' ') || text;
  return { headline, why: why.trim(), hasMore: why.trim().length > 0 };
}

export const statusLabel = (correct: boolean) => (correct ? '✓ Correct' : 'Not quite');
