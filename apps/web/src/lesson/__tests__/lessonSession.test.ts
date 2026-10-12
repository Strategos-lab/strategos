import { describe, expect, it } from 'vitest';
import { PLAY_CONTENT, diagnose, type Instance } from '@strategos/content/play';
import { advance, currentItem, isComplete, startLesson } from '../lessonSession';
import { instanceFor } from '../lessonInstances';

const LESSON_ID = 'm1.l1';
const items = PLAY_CONTENT.curriculum.modules
  .flatMap((m) => m.lessons)
  .find((l) => l.id === LESSON_ID)!
  .items.map((id) => PLAY_CONTENT.items.find((i) => i.id === id)!);

describe('lessonSession', () => {
  it('has the expected 3-item m1.l1 lesson to walk', () => {
    expect(items.map((i) => i.id)).toEqual(['i.m1.players', 'i.m1.actions', 'i.m1.players.three']);
  });

  it('records a correct response and advances the index without completing early', () => {
    let session = startLesson(LESSON_ID, items, 1, '2024-01-01T00:00:00.000Z');
    expect(currentItem(session)!.id).toBe('i.m1.players');
    expect(isComplete(session)).toBe(false);

    const item = currentItem(session)!;
    const instance = instanceFor(item, `1:${item.id}`);
    // Find the option in set 0 that is actually correct for this instance.
    const correctOption = item.optionSets![0]!.findIndex((_opt, i) => {
      const d = diagnoseOption(instance, i);
      return d.correct;
    });
    session = advance(session, instance, { type: 'reason_choice', set: 0, option: correctOption }, '2024-01-01T00:00:01.000Z');

    expect(session.index).toBe(1);
    expect(session.diagnoses['i.m1.players']!.correct).toBe(true);
    expect(session.diagnoses['i.m1.players']!.code).toBe('CORRECT');
    expect(session.responses['i.m1.players']).toEqual({ type: 'reason_choice', set: 0, option: correctOption });
    expect(isComplete(session)).toBe(false);
  });

  it('records an incorrect response with its error code', () => {
    let session = startLesson(LESSON_ID, items, 2, '2024-01-01T00:00:00.000Z');
    const item = currentItem(session)!;
    const instance = instanceFor(item, `2:${item.id}`);
    const wrongOption = item.optionSets![0]!.findIndex((_opt, i) => !diagnoseOption(instance, i).correct);
    session = advance(session, instance, { type: 'reason_choice', set: 0, option: wrongOption }, '2024-01-01T00:00:01.000Z');
    expect(session.diagnoses[item.id]!.correct).toBe(false);
    expect(session.diagnoses[item.id]!.code).not.toBe('CORRECT');
  });

  it('walks all items to completion and stamps completedAt only at the end', () => {
    let session = startLesson(LESSON_ID, items, 3, '2024-01-01T00:00:00.000Z');
    for (let step = 0; step < items.length; step++) {
      const item = currentItem(session)!;
      const instance = instanceFor(item, `3:${item.id}`);
      const anyOption = 0;
      session = advance(session, instance, { type: 'reason_choice', set: 0, option: anyOption }, `2024-01-01T00:00:0${step + 1}.000Z`);
      if (step < items.length - 1) expect(isComplete(session)).toBe(false);
    }
    expect(isComplete(session)).toBe(true);
    expect(session.completedAt).toBe('2024-01-01T00:00:03.000Z');
    expect(Object.keys(session.diagnoses)).toHaveLength(items.length);
  });

  it('is a no-op once the lesson is already complete', () => {
    let session = startLesson(LESSON_ID, items, 4, '2024-01-01T00:00:00.000Z');
    for (let step = 0; step < items.length; step++) {
      const item = currentItem(session)!;
      const instance = instanceFor(item, `4:${item.id}`);
      session = advance(session, instance, { type: 'reason_choice', set: 0, option: 0 }, `2024-01-01T00:00:0${step + 1}.000Z`);
    }
    expect(isComplete(session)).toBe(true);
    const finished = session;
    const item = items[0]!;
    const instance = instanceFor(item, `4:${item.id}`);
    const after = advance(session, instance, { type: 'reason_choice', set: 0, option: 0 }, '2099-01-01T00:00:00.000Z');
    expect(after).toEqual(finished);
  });
});

function diagnoseOption(instance: Instance, optionIndex: number) {
  return diagnose(instance, { type: 'reason_choice', set: 0, option: optionIndex });
}
