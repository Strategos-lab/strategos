import { ENGINE_VERSION } from '@strategos/engine';
import { PLAY_CONTENT } from '@strategos/content/play';
import { writeLearningEvent, type LearningEvent } from '../storage';
import type { LessonSession } from './lessonSession';

export const LESSON_ATTEMPT_EVENT_TYPE = 'lesson.attempt';

/** Build the learning event for a completed lesson attempt (no personal data; device-only). */
export function buildLessonAttemptEvent(session: LessonSession): Omit<LearningEvent, 'id'> {
  if (session.completedAt === null) throw new Error('lesson attempt is not complete');
  return {
    type: LESSON_ATTEMPT_EVENT_TYPE,
    createdAt: session.completedAt,
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    contentVersion: PLAY_CONTENT.curriculum.contentVersion,
    payload: {
      lessonId: session.lessonId,
      seed: session.seed,
      items: session.items.map((item) => ({
        itemId: item.id,
        response: session.responses[item.id] ?? null,
        correct: session.diagnoses[item.id]?.correct ?? false,
        code: session.diagnoses[item.id]?.code ?? null,
      })),
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    },
  };
}

export async function persistLessonAttempt(session: LessonSession): Promise<number> {
  return writeLearningEvent(buildLessonAttemptEvent(session));
}
