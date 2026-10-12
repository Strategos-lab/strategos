import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLAY_CONTENT, diagnose } from '@strategos/content/play';
import { LessonPage } from '../LessonPage';
import { instanceFor } from '../../lesson/lessonInstances';
import { listLearningEvents } from '../../storage';
import { resetLearningDbForTests } from '../../storage/learningDb';
import { LESSON_ATTEMPT_EVENT_TYPE } from '../../lesson/lessonAttemptRecord';

const DEV_LABELS = /Phase 0 stub|calibration scoring|Demo only|Debug: show engine output|Tap a cell|Nash|equilibri/i;
const SEED = 7;

const lesson = PLAY_CONTENT.curriculum.modules.flatMap((m) => m.lessons).find((l) => l.id === 'm1.l1')!;
const items = lesson.items.map((id) => PLAY_CONTENT.items.find((i) => i.id === id)!);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LessonPage lessonId="m1.l1" />
    </MemoryRouter>,
  );
}

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
const heading = () => screen.getByRole('heading', { level: 2 });

/** The first option index in set 0 that is actually correct for this instance (engine-checked). */
function correctOptionIndex(item: (typeof items)[number], seed: string) {
  const instance = instanceFor(item, seed);
  return item.optionSets![0]!.findIndex((_opt, i) => diagnose(instance, { type: 'reason_choice', set: 0, option: i }).correct);
}

describe('LessonPage (m1.l1, generic item/instance player)', () => {
  beforeEach(async () => {
    await resetLearningDbForTests();
  });
  afterEach(async () => {
    cleanup();
    await resetLearningDbForTests();
  });

  it('plays all three m1.l1 items end to end, shows feedback, reveals, and persists one attempt', async () => {
    renderAt(`/?seed=${SEED}`);
    expect(screen.getByRole('heading', { level: 1, name: 'STRATEGOS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Who is deciding?' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(DEV_LABELS);
    await click('Start');

    for (const item of items) {
      const seedForItem = `${SEED}:${item.id}`;
      const instance = instanceFor(item, seedForItem);
      const prompt = screen.getByRole('heading', { level: 2 });
      expect(prompt).toHaveFocus();
      expect(prompt.textContent).not.toMatch(/\{.*\}/);
      const group = screen.getByRole('group', { name: 'Your answer' });
      const optionButtons = Array.from(group.querySelectorAll('button'));
      expect(optionButtons).toHaveLength(item.optionSets![0]!.length);
      for (const btn of optionButtons) expect(btn.textContent).not.toMatch(/\{.*\}/);

      const wrongIdx = item.optionSets![0]!.findIndex(
        (_opt, i) => !diagnose(instance, { type: 'reason_choice', set: 0, option: i }).correct,
      );
      await userEvent.click(optionButtons[wrongIdx]!);
      expect(screen.getByTestId(`feedback-${item.id}`)).toHaveTextContent('Not quite');
      // No formal term is disclosed mid-lesson (disclosure happens only on the end-of-lesson reveal).
      expect(screen.getByTestId(`feedback-${item.id}`).textContent).not.toMatch(/players are|an action is/i);
      await click('Continue');
    }

    // End-of-lesson reveal for the "players" concept.
    expect(screen.getByTestId('step-reveal')).toBeInTheDocument();
    expect(screen.getAllByTestId('reveal-body').map((p) => p.textContent).join(' ')).toMatch(/players/i);
    expect(document.body.textContent).not.toMatch(DEV_LABELS);

    const events = await listLearningEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe(LESSON_ATTEMPT_EVENT_TYPE);
    expect(events[0]!.payload).toMatchObject({ lessonId: 'm1.l1', seed: SEED });
    const payloadItems = events[0]!.payload.items as Array<{ itemId: string; correct: boolean }>;
    expect(payloadItems.map((i) => i.itemId)).toEqual(items.map((i) => i.id));
    expect(payloadItems.every((i) => i.correct === false)).toBe(true);
    expect(await screen.findByTestId('save-note')).toHaveTextContent('saved on this device');
  });

  it('shows correct feedback and is deterministic for a fixed seed', async () => {
    renderAt(`/?seed=${SEED}`);
    await click('Start');
    const item = items[0]!;
    const seedForItem = `${SEED}:${item.id}`;
    const idx = correctOptionIndex(item, seedForItem);
    const group = screen.getByRole('group', { name: 'Your answer' });
    await userEvent.click(Array.from(group.querySelectorAll('button'))[idx]!);
    expect(screen.getByTestId(`feedback-${item.id}`)).toHaveTextContent('✓ Correct');
    await click('Continue');
    expect(heading()).toHaveFocus();
  });
});
