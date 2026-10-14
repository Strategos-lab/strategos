import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLAY_CONTENT } from '@strategos/content/play';
import { ModulesPage } from '../ModulesPage';
import { writeLearningEvent } from '../../storage';
import { resetLearningDbForTests } from '../../storage/learningDb';
import { LESSON_ATTEMPT_EVENT_TYPE } from '../../lesson/lessonAttemptRecord';

const DEV_LABELS = /Phase 0 stub|calibration scoring|Demo only|Debug: show engine output|Tap a cell|Nash|equilibri/i;

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ModulesPage />
    </MemoryRouter>,
  );
}

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

describe('ModulesPage (lesson menu)', () => {
  beforeEach(async () => {
    await resetLearningDbForTests();
  });
  afterEach(async () => {
    cleanup();
    await resetLearningDbForTests();
  });

  it('lists every module and lesson, linking each playable lesson to its route', async () => {
    renderMenu();
    await waitFor(() => expect(screen.getByTestId('btn-continue-lesson')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: 'STRATEGOS' })).toBeInTheDocument();
    expect(screen.getByTestId('intro-cadence')).toHaveTextContent('A few exercises a day');
    expect(document.body.textContent).not.toMatch(DEV_LABELS);
    expect(document.body.textContent).not.toMatch(/streak|badge|points|level up|xp\b/i);

    for (const m of PLAY_CONTENT.curriculum.modules) {
      for (const l of m.lessons) {
        const link = screen.getByTestId(`lesson-${l.id}`);
        expect(link).toHaveAttribute('href', `/lesson/${l.id}`);
        expect(link).toHaveTextContent(l.workingTitle);
      }
    }
  });

  it('with nothing completed, offers to start m1.l1 and marks later lessons as needing prerequisites first', async () => {
    renderMenu();
    await waitFor(() => expect(screen.getByTestId('btn-continue-lesson')).toHaveTextContent('Start'));
    expect(screen.getByTestId('btn-continue-lesson')).toHaveAttribute('href', '/lesson/m1.l1');
    // m1.l2 requires players/actions from m1.l1, not yet completed.
    expect(screen.getByTestId('lesson-m1.l2-needs')).toHaveTextContent('Complete "Who is deciding?" first');
    expect(screen.queryByTestId('lesson-m1.l1-done')).toBeNull();
    // Still a plain, clickable link — nothing is hard-blocked.
    expect(screen.getByTestId('lesson-m1.l2')).toHaveAttribute('href', '/lesson/m1.l2');
  });

  it('after completing m1.l1, marks it done and offers to continue with m1.l2', async () => {
    await completeLesson('m1.l1');
    renderMenu();
    await waitFor(() => expect(screen.getByTestId('lesson-m1.l1-done')).toHaveTextContent('Completed'));
    expect(screen.getByTestId('btn-continue-lesson')).toHaveTextContent('Continue');
    expect(screen.getByTestId('btn-continue-lesson')).toHaveAttribute('href', '/lesson/m1.l2');
    expect(screen.queryByTestId('lesson-m1.l2-needs')).toBeNull();
  });

  it('offers no continue entry once every lesson is completed', async () => {
    for (const m of PLAY_CONTENT.curriculum.modules) for (const l of m.lessons) await completeLesson(l.id);
    renderMenu();
    await waitFor(() => expect(screen.getByTestId('lesson-m3.l5-done')).toBeInTheDocument());
    expect(screen.queryByTestId('btn-continue-lesson')).toBeNull();
  });
});
