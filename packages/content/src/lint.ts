/**
 * Content lint (plan §10.4–10.5, Production Rules). Text-level rules on learner-facing strings.
 * Banned *topics* are not detected here: the repository-wide banned-terms hygiene test scans this
 * package's files, and every skin declares a domain from DOMAINS (a structural check).
 */

export type FieldKind =
  | 'title'
  | 'situation'
  | 'glance'
  | 'prompt'
  | 'option'
  | 'feedback'
  | 'outcome'
  | 'reveal'
  | 'actionLabel'
  | 'matrixLabel'
  | 'rubric';

/** Maximum characters per field kind (rendered placeholders count as their template text). */
export const MAX_LENGTH: Record<FieldKind, number> = {
  title: 60,
  situation: 320,
  glance: 220,
  prompt: 140,
  option: 120,
  feedback: 280,
  outcome: 160,
  reveal: 320,
  actionLabel: 24,
  matrixLabel: 120,
  rubric: 220,
};

export const FILLER = /\b(great job|well done|awesome|amazing|fantastic|brilliant|excellent|nice work|good job|keep (it up|going)|you('ve| have) got this|you can do it|don'?t give up|believe in yourself|superstar|nailed it)\b/i;
export const TRAIT = /\b(you are (a |an )?(natural|born|smart|clever|gifted|talented|bad at|good at|strategic)|natural(ly)? (strategist|talent)|talented|gifted|kind of person|type of person|personality)\b/i;
/** Outcome-judging or moralising words (plan §10.5, Production Rules M). */
export const MORALISING = /\b(fair|unfair|fairness|selfish\w*|greed\w*|lazy|deserve\w*|blame\w*|shame\w*|cheat\w*|betray\w*|lucky|unlucky|luckily|foolish|stupid|naive|good person|bad person|should have known)\b/i;
export const COLOUR_ONLY = /\b(red|green|blue|yellow|purple|highlighted|coloured|colored|shaded)\b/i;
/** Spellings the plan fixes as Indian (British-based) English (plan §10.5). */
export const US_SPELLING = /\b(colors?|behavior\w*|organiz\w*|analyz\w*|cent(er|ers)|favor\w*|honor\w*|neighbor\w*|realiz\w*|recogniz\w*|apologiz\w*|defense|catalog|labeled|labeling|modeling|modeled|traveled|traveling)\b/i;
const DIGIT = /\d/;
/** Kinds whose numbers must come from engine slots, never from copy. */
const NO_DIGITS: FieldKind[] = ['prompt', 'option', 'feedback', 'outcome', 'situation', 'glance'];

export interface LintIssue {
  where: string;
  message: string;
}

/** `length: false` for templates whose length is checked after rendering. */
export function lintField(where: string, kind: FieldKind, text: string, opts: { length?: boolean } = {}): LintIssue[] {
  const out: LintIssue[] = [];
  const add = (message: string) => out.push({ where, message });
  if (typeof text !== 'string' || text.trim() === '') {
    add('empty text');
    return out;
  }
  if (opts.length !== false && text.length > MAX_LENGTH[kind]) add(`too long for ${kind} (${text.length} > ${MAX_LENGTH[kind]})`);
  if (FILLER.test(text)) add(`motivational filler: "${FILLER.exec(text)![0]}"`);
  if (TRAIT.test(text)) add(`trait language: "${TRAIT.exec(text)![0]}"`);
  if (MORALISING.test(text)) add(`outcome-judging or moralising word: "${MORALISING.exec(text)![0]}"`);
  if (COLOUR_ONLY.test(text)) add(`colour reference (meaning must not rely on colour): "${COLOUR_ONLY.exec(text)![0]}"`);
  if (US_SPELLING.test(text)) add(`use Indian English spelling: "${US_SPELLING.exec(text)![0]}"`);
  if (NO_DIGITS.includes(kind) && DIGIT.test(text.replace(/\{[^{}]*\}/g, ''))) add('literal number in copy: numbers must come from engine slots');
  if (kind === 'actionLabel' && text.split(/\s+/).length > 3) add('action label longer than three words');
  return out;
}

/** Evidence-first feedback: no bare verdict opener; the opening clause carries a slot. */
export const VERDICT_OPENER = /^(correct|incorrect|wrong|right|yes|no|not quite|good|exactly|true|false)\b/i;

export function leadClause(text: string): string {
  const m = /^.*?[.!?](\s|$)/.exec(text);
  return (m ? m[0] : text).trim();
}

const STOP = new Set(
  'a an the and or but of to in on at for with by from is are was be it its you your yours they their them both each either neither not if then than this that what which who whom will would can could do does did has have had one two as so also more most other others'.split(' '),
);

/** Token-set Jaccard similarity over lower-case word tokens (near-duplicate check). */
export function similarity(a: string, b: string): number {
  const tok = (s: string) =>
    new Set((s.toLowerCase().replace(/\{[^{}]*\}/g, ' ').match(/\p{L}+/gu) ?? []).filter((w) => !STOP.has(w)));
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
