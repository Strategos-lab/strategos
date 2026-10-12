/**
 * Item-list-generic lesson session (Phase 3, increment 1): walks an arbitrary list of items from
 * one lesson, one at a time, with no fixed "predict/decide/reveal" step shape — unlike
 * `apps/web/src/slice/machine.ts`, which models exactly one such encounter.
 */
import { diagnose, type Diagnosis, type Instance, type Item, type Response } from '@strategos/content/play';

export interface LessonSession {
  lessonId: string;
  items: Item[];
  index: number;
  seed: number | string;
  responses: Record<string, Response>;
  diagnoses: Record<string, Diagnosis>;
  startedAt: string;
  completedAt: string | null;
}

export function startLesson(lessonId: string, items: Item[], seed: number | string, startedAt: string): LessonSession {
  return { lessonId, items, index: 0, seed, responses: {}, diagnoses: {}, startedAt, completedAt: null };
}

export function currentItem(session: LessonSession): Item | undefined {
  return session.items[session.index];
}

export function isComplete(session: LessonSession): boolean {
  return session.completedAt !== null;
}

/**
 * Diagnose a response to the current item against its instance, record it, and move to the next
 * item (or mark the lesson complete when it was the last one). A no-op once already complete.
 */
export function advance(session: LessonSession, instance: Instance, response: Response, now: string): LessonSession {
  if (isComplete(session)) return session;
  const item = currentItem(session);
  if (!item) return session;
  const diagnosis = diagnose(instance, response);
  const index = session.index + 1;
  const done = index >= session.items.length;
  return {
    ...session,
    index,
    responses: { ...session.responses, [item.id]: response },
    diagnoses: { ...session.diagnoses, [item.id]: diagnosis },
    completedAt: done ? now : null,
  };
}
