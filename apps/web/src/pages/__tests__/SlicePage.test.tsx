import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SlicePage } from '../SlicePage';
import { CONTEXT_FIELDS, FIRST_SCENARIO } from '../../content';
import { listLearningEvents } from '../../storage';
import { resetLearningDbForTests } from '../../storage/learningDb';
import { ATTEMPT_EVENT_TYPE } from '../../slice/attemptRecord';

const DEV_LABELS = /Phase 0 stub|calibration scoring|Demo only|Debug: show engine output|Tap a cell/i;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SlicePage />
    </MemoryRouter>,
  );
}

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
const heading = () => screen.getByRole('heading', { level: 2 });

describe('SlicePage (learner vertical slice)', () => {
  beforeEach(async () => {
    await resetLearningDbForTests();
    localStorage.clear();
  });
  afterEach(async () => {
    cleanup();
    await resetLearningDbForTests();
  });

  it('walks the full slice with focus on each step heading and persists the attempt', async () => {
    renderAt('/?seed=3'); // seed 3 → Roommate B chooses Leave it
    expect(screen.getByRole('heading', { level: 1, name: 'STRATEGOS' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(DEV_LABELS);
    await click('Start');

    // 1 ENCOUNTER: all ten items, no matrix, no numbers grid.
    expect(heading()).toHaveTextContent('The situation');
    expect(heading()).toHaveFocus();
    expect(screen.getByTestId('role-statement')).toHaveTextContent('You are Roommate A.');
    for (const { key } of CONTEXT_FIELDS) {
      expect(screen.getByTestId(`context-${key}`)).toHaveTextContent(FIRST_SCENARIO.context[key]);
    }
    expect(document.querySelector('table')).toBeNull();
    expect(screen.queryByTestId('payoff-matrix')).toBeNull();
    await click('Continue');

    // 2 PREDICT: actions only.
    expect(heading()).toHaveTextContent('What will B choose?');
    expect(heading()).toHaveFocus();
    const predictGroup = screen.getByRole('group');
    expect(within(predictGroup).getAllByRole('button').map((b) => b.textContent)).toEqual(['Clean', 'Leave it']);
    await userEvent.click(within(predictGroup).getByRole('button', { name: 'Leave it' }));

    // 3 CONFIDENCE
    expect(heading()).toHaveTextContent('How sure are you?');
    expect(document.querySelector('.prediction-recap')).toHaveTextContent('B'); expect(document.querySelector('.prediction-recap')).toHaveTextContent('Leave it');
    expect(document.body.textContent).not.toMatch(/calibration|stub/i);
    await click('Continue');

    // 4 DECIDE: own actions only, never joint outcomes.
    expect(heading()).toHaveTextContent('What will you choose?');
    expect(screen.getByText(/B is choosing at the same time/)).toBeInTheDocument();
    const decideGroup = screen.getByRole('group');
    const labels = within(decideGroup).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['Clean', 'Leave it']);
    expect(document.querySelector('table')).toBeNull();
    await userEvent.click(within(decideGroup).getByRole('button', { name: 'Clean' }));

    // 5 OPPONENT RESPONSE: no Back after the reveal.
    expect(screen.getByTestId('response-text')).toHaveTextContent('You chose Clean. Roommate B chose Leave it.');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(document.querySelector('table')).toBeNull();
    await click('Continue');

    // 6 OUTCOME in words first.
    expect(screen.getByTestId('outcome-words')).toHaveTextContent('You get 0. Roommate B gets 5.');
    expect(screen.getByTestId('outcome-story')).toHaveTextContent(FIRST_SCENARIO.outcomes['clean|leave']!);
    expect(screen.getByTestId('outcome-story')).not.toHaveTextContent(/fair|decent|enjoyed it for free|good outcome|bad outcome/i);
    expect(screen.getByTestId('outcome-pair')).toHaveTextContent('Outcome: (0, 5)');
    expect(document.querySelector('table')).toBeNull();
    await click('Continue');

    // 7 MATRIX REVEAL: read-only, header cells, realised cell highlighted.
    expect(heading()).toHaveTextContent('The whole situation');
    expect(screen.getByText('Here is the whole game as a table.')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).queryAllByRole('button')).toHaveLength(0);
    expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Cleanyour choice', 'Leave it']);
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('realised-cell')).toHaveTextContent('0,5');
    expect(screen.queryByTestId('matrix-landing')).toBeNull();
    await click('Continue');

    // 8 STRUCTURED EXPLANATION
    expect(heading()).toHaveTextContent('Check your reasoning');
    const cont = screen.getByTestId('btn-continue');
    expect(cont).toBeDisabled();
    await userEvent.click(within(screen.getByTestId('question-if-b-cleans')).getByRole('button', { name: 'Leave it' }));
    expect(screen.getByTestId('feedback-if-b-cleans')).toHaveTextContent('Leave it gives you 5; Clean gives you 3.');
    expect(screen.getByTestId('feedback-if-b-cleans').querySelector('.feedback-headline')!.textContent).toBe(
      'Leave it gives you 5; Clean gives you 3.',
    );
    await userEvent.click(within(screen.getByTestId('question-if-b-leaves')).getByRole('button', { name: 'Clean' }));
    expect(screen.getByTestId('feedback-if-b-leaves')).toHaveTextContent('Not quite');
    await userEvent.click(
      within(screen.getByTestId('question-either-way')).getByRole('button', { name: 'Leave it is always better.' }),
    );
    expect(screen.getByTestId('feedback-either-way')).toHaveTextContent('Leave it is a dominant strategy');
    expect(screen.getByTestId('closing-note')).toHaveTextContent('individually better action leads to a result that is worse for both');
    expect(document.body.textContent).not.toMatch(/nash|equilibri|dilemma/i);
    await click('Continue');

    // 9 SUMMARY
    expect(heading()).toHaveTextContent('Summary');
    expect(heading()).toHaveFocus();
    expect(screen.getByTestId('summary-prediction')).toHaveTextContent('Leave it');
    expect(screen.getByTestId('summary-prediction')).toHaveTextContent('75% confident');
    expect(screen.getByTestId('summary-decision-quality')).toHaveTextContent('Not the best response to your prediction');
    expect(screen.getByTestId('summary-decision')).toHaveTextContent('judged using what you knew before B chose');
    expect(screen.getByTestId('summary-outcome')).toHaveTextContent('depended on what B actually chose');
    expect(screen.getByTestId('summary-outcome-pair')).toHaveTextContent('0 for you');
    expect(screen.getByTestId('summary-outcome-pair')).toHaveTextContent('5 for B');
    expect(screen.getByTestId('summary-policy')).toHaveTextContent('70% Leave it, 30% Clean');
    expect(document.body.textContent).not.toMatch(/\b[Ss]eed\b/);

    await waitFor(async () => {
      const events = await listLearningEvents();
      expect(events).toHaveLength(1);
    });
    const [ev] = await listLearningEvents();
    expect(ev!.type).toBe(ATTEMPT_EVENT_TYPE);
    expect(ev!.contentVersion).toBe(FIRST_SCENARIO.contentVersion);
    expect(ev!.payload).toMatchObject({
      scenarioId: 'roommate-kitchen',
      seed: 3,
      prediction: 'leave',
      confidencePct: 75,
      choice: 'clean',
      opponentAction: 'leave',
      outcomePayoffs: ['0', '5'],
      consistentWithOwnPrediction: false,
      answers: {
        'if-b-cleans': { answer: 'leave', correct: true },
        'if-b-leaves': { answer: 'clean', correct: false },
        'either-way': { answer: 'leave', correct: true },
      },
    });
    expect(await screen.findByTestId('save-note')).toHaveTextContent('saved on this device');

    // Try again → fresh attempt at the encounter.
    await click('Try again');
    expect(heading()).toHaveTextContent('The situation');
    expect(document.body.textContent).not.toMatch(DEV_LABELS);
  });

  it('Back works before the decision only', async () => {
    renderAt('/?seed=1');
    await click('Start');
    await click('Continue');
    await click('Back');
    expect(heading()).toHaveTextContent('The situation');
    await click('Continue');
    await click('Clean');
    await click('Back');
    expect(heading()).toHaveTextContent('What will B choose?');
    await click('Clean');
    await click('Continue');
    await click('Back');
    expect(heading()).toHaveTextContent('How sure are you?');
    await click('Continue');
    await click('Leave it');
    expect(screen.getByTestId('response-text')).toHaveTextContent('You chose Leave it. Roommate B chose Clean.');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
