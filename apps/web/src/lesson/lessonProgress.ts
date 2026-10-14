/**
 * Lesson readiness, derived from what's already recorded on this device — no new tracking system,
 * no mastery scoring, no scheduling (that's Phase 4+ per the V1 Plan's own phase sequence). A
 * lesson is "completed" if a lesson.attempt event exists for it; "ready" if every concept its
 * curriculum entry requires was introduced by some completed lesson. This is read-only UI
 * guidance, never enforced: nothing in the player blocks starting a lesson that isn't ready.
 */
import { PLAY_CONTENT, type Lesson } from '@strategos/content/play';
import { listLearningEvents } from '../storage';
import { LESSON_ATTEMPT_EVENT_TYPE } from './lessonAttemptRecord';

export interface LessonProgress {
  completed: Set<string>;
  ready: Set<string>;
}

function allLessons(): Lesson[] {
  return PLAY_CONTENT.curriculum.modules.flatMap((m) => m.lessons);
}

/** The lesson(s) not yet completed whose `introduces` cover what `lesson` still needs. */
export function missingPrerequisites(lesson: Lesson, completed: Set<string>): Lesson[] {
  const introducedBy = new Map<string, Lesson>();
  for (const l of allLessons()) for (const c of l.introduces) introducedBy.set(c, l);
  const need = lesson.requires.filter((c) => {
    const introducer = introducedBy.get(c);
    return !(introducer && completed.has(introducer.id));
  });
  const seen = new Set<string>();
  const out: Lesson[] = [];
  for (const c of need) {
    const l = introducedBy.get(c);
    if (l && !seen.has(l.id)) {
      seen.add(l.id);
      out.push(l);
    }
  }
  return out;
}

export async function loadLessonProgress(): Promise<LessonProgress> {
  const events = await listLearningEvents();
  const completed = new Set<string>();
  for (const e of events) {
    if (e.type !== LESSON_ATTEMPT_EVENT_TYPE) continue;
    const lessonId = (e.payload as { lessonId?: unknown }).lessonId;
    if (typeof lessonId === 'string') completed.add(lessonId);
  }
  const ready = new Set<string>();
  for (const l of allLessons()) {
    if (missingPrerequisites(l, completed).length === 0) ready.add(l.id);
  }
  return { completed, ready };
}

/** The first not-yet-completed lesson that's ready, in curriculum order; null if none (e.g. done). */
export function nextLesson(progress: LessonProgress): Lesson | null {
  for (const l of allLessons()) {
    if (progress.ready.has(l.id) && !progress.completed.has(l.id)) return l;
  }
  return null;
}
