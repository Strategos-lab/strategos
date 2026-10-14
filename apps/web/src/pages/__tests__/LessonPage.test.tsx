import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLAY_CONTENT, diagnose, storyText } from '@strategos/content/play';
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
    expect(document.body.textContent).not.toMatch(/great job|good job|streak|badge|points|level up/i);
    expect(document.body.textContent).not.toMatch(DEV_LABELS);
    await click('Start');

    for (const item of items) {
      const seedForItem = `${SEED}:${item.id}`;
      const instance = instanceFor(item, seedForItem);
      const prompt = screen.getByRole('heading', { level: 2 });
      expect(prompt).toHaveFocus();
      expect(prompt.textContent).not.toMatch(/\{.*\}/);
      // The story must be told before the question is asked, or it can't be answered.
      expect(screen.getByTestId('situation')).toHaveTextContent(storyText(instance, 'situation'));
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

  it('plays a fill_in item (m1.l2) with inline blanks checked against the engine', async () => {
    render(
      <MemoryRouter initialEntries={[`/?seed=${SEED}`]}>
        <LessonPage lessonId="m1.l2" />
      </MemoryRouter>,
    );
    await click('Start');
    // First two items are reason_choice; answer either option to reach the fill_in item.
    for (let i = 0; i < 2; i++) {
      const group = screen.getByRole('group', { name: 'Your answer' });
      await userEvent.click(group.querySelectorAll('button')[0]!);
      await click('Continue');
    }

    const payoffItem = PLAY_CONTENT.items.find((i) => i.id === 'i.m1.payoff')!;
    const instance = instanceFor(payoffItem, `${SEED}:${payoffItem.id}`);
    expect(screen.getByTestId('item-i.m1.payoff')).toBeInTheDocument();
    const s1 = screen.getByTestId('blank-s1') as HTMLInputElement;
    const s2 = screen.getByTestId('blank-s2') as HTMLInputElement;
    expect(screen.getByTestId('btn-check')).toBeDisabled();

    // Wrong answers first: swapped payoffs (the MISREAD_PAYOFF_OWNER known-wrong value).
    const wrongS1 = payoffItem.slots![0]!.knownWrong[0]!.value;
    const wrongS2 = payoffItem.slots![1]!.knownWrong[0]!.value;
    const { slotValue } = await import('@strategos/content/play');
    await userEvent.type(s1, slotValue(wrongS1, instance));
    await userEvent.type(s2, slotValue(wrongS2, instance));
    expect(screen.getByTestId('btn-check')).toBeEnabled();
    await click('Check');
    expect(screen.getByTestId('feedback-i.m1.payoff')).toHaveTextContent('Not quite');
    expect(s1).toBeDisabled();
    await click('Continue');
    expect(screen.getByTestId('step-reveal')).toBeInTheDocument();
  });

  it('plays an own_words item (m1.l4) with a self-check shown after submitting', async () => {
    render(
      <MemoryRouter initialEntries={[`/?seed=${SEED}`]}>
        <LessonPage lessonId="m1.l4" />
      </MemoryRouter>,
    );
    await click('Start');
    for (let i = 0; i < 3; i++) {
      const group = screen.getByRole('group', { name: 'Your answer' });
      await userEvent.click(group.querySelectorAll('button')[0]!);
      await click('Continue');
    }
    expect(screen.getByTestId('item-i.m1.words')).toBeInTheDocument();
    expect(screen.queryByTestId('self-check')).toBeNull();
    const input = screen.getByTestId('own-words-input');
    await userEvent.type(input, 'I would pick my best response to what I believe they will do.');
    await click('Submit');
    expect(input).toBeDisabled();
    const check = screen.getByTestId('self-check');
    expect(check.textContent).toContain('Names everyone whose choice changes the result');
    await click('Continue');
    // Four more reason_choice items remain before this lesson's reveal.
    for (let i = 0; i < 4; i++) {
      const group = screen.getByRole('group', { name: 'Your answer' });
      await userEvent.click(group.querySelectorAll('button')[0]!);
      await click('Continue');
    }
    expect(screen.getByTestId('step-reveal')).toBeInTheDocument();
    const events = await listLearningEvents();
    const payload = events[0]!.payload as { items: Array<{ itemId: string; code: string }> };
    expect(payload.items.find((i) => i.itemId === 'i.m1.words')!.code).toBe('SELF_ASSESSED');
  });

  it('plays the roommate scenario directly for m3.l1, not the generic item flow', async () => {
    render(
      <MemoryRouter initialEntries={['/?seed=3']}>
        <LessonPage lessonId="m3.l1" />
      </MemoryRouter>,
    );
    // The roommate scenario's own intro (SlicePage), not LessonPage's generic lesson intro.
    expect(screen.getByRole('heading', { level: 1, name: 'STRATEGOS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'The shared kitchen' })).toBeInTheDocument();
    expect(screen.queryByText('All lessons')).toBeNull();
    expect(screen.queryByTestId('item-i.m3.dom.reason')).toBeNull();
    await click('Start');
    expect(heading()).toHaveTextContent('The situation');
  });
});
