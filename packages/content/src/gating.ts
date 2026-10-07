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
      const hits = findTerms(t.text, c);
      if (hits.length === 0) continue;
      if (t.hide === c.id) {
        out.push({ where: t.where, message: `names the hidden concept "${c.id}" (${hits.join(', ')}) before the answer` });
      } else if (!termAllowed(c, t.lesson, t.step, order)) {
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
