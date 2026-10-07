/**
 * Presentation-only split of authored feedback text (no game logic): the leading status word
 * ("Yes." / "Right." / "Not quite.") is replaced in the UI by a chrome label derived from the
 * existing correctness flag; the concluding statement becomes the headline; the full authored text
 * stays available behind a "Why" disclosure when it says more than the headline.
 */
const STATUS = /^(yes|right|correct|not quite)\.$/i;

export interface FeedbackParts {
  headline: string;
  /** Full authored text, verbatim. */
  full: string;
  /** True when the full text contains more than the headline (show a "Why" disclosure). */
  hasMore: boolean;
}

export function splitStatements(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 0);
}

export function feedbackParts(text: string): FeedbackParts {
  const statements = splitStatements(text);
  const body = statements.length > 1 && STATUS.test(statements[0]!) ? statements.slice(1) : statements;
  const headline = body[body.length - 1] ?? text;
  return { headline, full: text, hasMore: body.length > 1 };
}

export const statusLabel = (correct: boolean) => (correct ? '✓ Correct' : 'Not quite');
