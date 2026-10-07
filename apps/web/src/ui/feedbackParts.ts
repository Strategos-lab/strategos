/**
 * Presentation-only split of authored feedback text (no game logic): a leading status word
 * ("Yes." / "Right." / "Not quite." / "Correct.") is stripped when present — the UI chrome shows
 * Correct / Not quite from the correctness flag. The first remaining statement is the evidence
 * headline; later statements (conclusions, definitions) sit behind an optional "Why" disclosure.
 */
const STATUS = /^(yes|right|correct|not quite)\.$/i;

export interface FeedbackParts {
  /** Evidence-first headline (first body statement). */
  headline: string;
  /** Statements after the headline (conclusion / definition), for the Why disclosure. */
  why: string;
  /** Full authored text, verbatim. */
  full: string;
  /** True when there is more than the headline (show a "Why" disclosure). */
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
  const headline = body[0] ?? text;
  const why = body.slice(1).join(' ');
  return { headline, why, full: text, hasMore: why.length > 0 };
}

export const statusLabel = (correct: boolean) => (correct ? '✓ Correct' : 'Not quite');
