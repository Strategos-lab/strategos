/**
 * Item-list-generic lesson session (Phase 3, increment 1): walks an arbitrary list of items from
 * one lesson, one at a time, with no fixed "predict/decide/reveal" step shape — unlike
 * `apps/web/src/slice/machine.ts`, which models exactly one such encounter.
 */
import { diagnose, type Diagnosis, type Instance, type Item, type Response } from '@strategos/content/play';

/** own_words items have no engine-checkable answer (diagnose()'s Response union has no variant for
 * them); self-assessment is not scored, so they are stored and sequenced separately from Response. */
export interface OwnWordsResponse {
  type: 'own_words';
  text: string;
}

export type LessonResponse = Response | OwnWordsResponse;

/** Sentinel diagnosis code for a self-assessed (not engine-checked) own_words item. */
export const SELF_ASSESSED = 'SELF_ASSESSED';

export interface LessonSession {
  lessonId: string;
  items: Item[];
  index: number;
  seed: number | string;
  responses: Record<string, LessonResponse>;
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

/**
 * Record an own_words item's free-text response (self-assessed, never engine-checked) and move to
 * the next item (or mark the lesson complete). A no-op once already complete.
 */
export function advanceSelfAssessed(session: LessonSession, text: string, now: string): LessonSession {
  if (isComplete(session)) return session;
  const item = currentItem(session);
  if (!item) return session;
  const index = session.index + 1;
  const done = index >= session.items.length;
  return {
    ...session,
    index,
    responses: { ...session.responses, [item.id]: { type: 'own_words', text } },
    diagnoses: { ...session.diagnoses, [item.id]: { correct: true, code: SELF_ASSESSED } },
    completedAt: done ? now : null,
  };
}
