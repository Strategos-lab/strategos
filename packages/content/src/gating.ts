import { STEPS, type Concept, type Curriculum, type Step } from './types.ts';

export interface GatedText {
  /** Where the text is shown. */
  lesson: string;
  step: Step;
  text: string;
  /** Source, for error messages. */
  where: string;
  /** Concept that must stay unnamed (transfer-hidden / held-out pre-answer text). */
  hide?: string;
  /** An answer option: a claim the learner evaluates (formal terms checked; conclusion forms exempt). */
  claim?: boolean;
  /** Pre-answer text of a transfer or held-out item: no concept's conclusion may be asserted. */
  assessment?: boolean;
}

export function lessonOrder(c: Curriculum): string[] {
  return c.modules.flatMap((m) => m.lessons.map((l) => l.id));
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function termRegex(stem: string): RegExp {
  return new RegExp(`(?<![\\p{L}])${esc(stem).replace(/ /g, '[\\s\\u00a0-]+')}`, 'iu');
}

export function findTerms(text: string, concept: Concept): string[] {
  return concept.forbidden.filter((f) => termRegex(f).test(text));
}

/**
 * Plain-language conclusion forms asserted in `text` (questions are not assertions). Matched clause by
 * clause, so "fine either way, a little better if …" (a payoff comparison) does not match while
 * "better for you either way" does.
 */
export function findConclusions(text: string, concept: Concept): string[] {
  const res = (concept.conclusions ?? []).map((r) => new RegExp(r, 'iu'));
  if (res.length === 0 || typeof text !== 'string') return [];
  const hits: string[] = [];
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    if (part.trim().endsWith('?')) continue;
    for (const clause of part.split(/[,;:\u2014\u2013]|\s(?:and|but|while)\s/)) {
      if (res.some((r) => r.test(clause))) hits.push(clause.trim());
    }
  }
  return hits;
}

/** Is concept `c`'s formal vocabulary allowed at (lesson, step)? */
export function termAllowed(c: Concept, lesson: string, step: Step, order: string[]): boolean {
  if (c.introducedIn === null) return false;
  const li = order.indexOf(lesson);
  const ci = order.indexOf(c.introducedIn);
  if (li < 0 || ci < 0) return false;
  if (li > ci) return true;
  if (li < ci) return false;
  return STEPS.indexOf(step) >= STEPS.indexOf(c.revealStep);
}

export interface GatingIssue {
  where: string;
  message: string;
}

export function checkGating(texts: GatedText[], concepts: Concept[], curriculum: Curriculum): GatingIssue[] {
  const order = lessonOrder(curriculum);
  const out: GatingIssue[] = [];
  for (const t of texts) {
    for (const c of concepts) {
      const allowed = termAllowed(c, t.lesson, t.step, order);
      if (!t.claim) {
        for (const h of findConclusions(t.text, c)) {
          if (t.hide === c.id || t.assessment || !allowed) {
            out.push({ where: t.where, message: `asserts the conclusion of "${c.id}" in plain language ("${h}") ${t.assessment || t.hide === c.id ? 'in transfer/held-out pre-answer text' : `at ${t.lesson}/${t.step}, before its reveal`}` });
          }
        }
      }
      const hits = findTerms(t.text, c);
      if (hits.length === 0) continue;
      if (t.hide === c.id) {
        out.push({ where: t.where, message: `names the hidden concept "${c.id}" (${hits.join(', ')}) before the answer` });
      } else if (!allowed) {
        out.push({
          where: t.where,
          message: `uses "${hits.join(', ')}" (${c.id}) at ${t.lesson}/${t.step}, before its reveal (${c.introducedIn ?? 'not in Modules 1–3'}/${c.revealStep})`,
        });
      }
    }
  }
  return out;
}

/** Concept prerequisite cycle check; returns one cycle path or null. */
export function findCycle(concepts: Concept[]): string[] | null {
  const by = new Map(concepts.map((c) => [c.id, c]));
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 1);
    stack.push(id);
    for (const p of by.get(id)?.prerequisites ?? []) {
      const cyc = visit(p);
      if (cyc) return cyc;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const c of concepts) {
    const cyc = visit(c.id);
    if (cyc) return cyc;
  }
  return null;
}
