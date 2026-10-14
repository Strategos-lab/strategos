import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLAY_CONTENT } from '@strategos/content/play';
import { writeLearningEvent } from '../../storage';
import { resetLearningDbForTests } from '../../storage/learningDb';
import { LESSON_ATTEMPT_EVENT_TYPE } from '../lessonAttemptRecord';
import { loadLessonProgress, missingPrerequisites, nextLesson } from '../lessonProgress';

const lessons = PLAY_CONTENT.curriculum.modules.flatMap((m) => m.lessons);
const find = (id: string) => lessons.find((l) => l.id === id)!;

async function completeLesson(lessonId: string) {
  await writeLearningEvent({
    type: LESSON_ATTEMPT_EVENT_TYPE,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    engineVersion: 'test',
    contentVersion: 'test',
    payload: { lessonId, items: [] },
  });
}

describe('lessonProgress', () => {
  beforeEach(async () => {
    await resetLearningDbForTests();
  });
  afterEach(async () => {
    await resetLearningDbForTests();
  });

  it('missingPrerequisites: a lesson with no requires is never missing anything', () => {
    expect(missingPrerequisites(find('m1.l1'), new Set())).toEqual([]);
  });

  it('missingPrerequisites: names the uncompleted lesson that introduces a required concept', () => {
    const missing = missingPrerequisites(find('m1.l2'), new Set());
    expect(missing.map((l) => l.id)).toEqual(['m1.l1']);
  });

  it('missingPrerequisites: empty once the introducing lesson is completed', () => {
    expect(missingPrerequisites(find('m1.l2'), new Set(['m1.l1']))).toEqual([]);
  });

  it('missingPrerequisites: a lesson needing two concepts from different lessons lists both', () => {
    // m1.l4 requires players, actions (m1.l1) and payoff (m1.l2).
    const missing = missingPrerequisites(find('m1.l4'), new Set());
    expect(missing.map((l) => l.id).sort()).toEqual(['m1.l1', 'm1.l2']);
  });

  it('loadLessonProgress: nothing completed yet — only m1.l1 is ready', async () => {
    const progress = await loadLessonProgress();
    expect(progress.completed.size).toBe(0);
    expect(progress.ready.has('m1.l1')).toBe(true);
    expect(progress.ready.has('m1.l2')).toBe(false);
  });

  it('loadLessonProgress: completing m1.l1 makes m1.l2 and m1.l3 (but not m1.l4) ready', async () => {
    await completeLesson('m1.l1');
    const progress = await loadLessonProgress();
    expect(progress.completed.has('m1.l1')).toBe(true);
    expect(progress.ready.has('m1.l2')).toBe(true);
    expect(progress.ready.has('m1.l3')).toBe(true);
    expect(progress.ready.has('m1.l4')).toBe(false); // still needs payoff from m1.l2
  });

  it('nextLesson: m1.l1 first, then the next ready-but-incomplete lesson in curriculum order', async () => {
    expect(nextLesson(await loadLessonProgress())!.id).toBe('m1.l1');
    await completeLesson('m1.l1');
    expect(nextLesson(await loadLessonProgress())!.id).toBe('m1.l2');
  });

  it('nextLesson: null once every lesson is completed', async () => {
    for (const l of lessons) await completeLesson(l.id);
    expect(nextLesson(await loadLessonProgress())).toBeNull();
  });
});
