import { expect, test, type Page } from '@playwright/test';

const DEV_LABELS = /Phase 0 stub|calibration scoring|Demo only|Debug: show engine output|Developer mode/i;
const TAP_A_CELL = /Tap a cell/i;

const h2 = (page: Page) => page.locator('#step-heading');

async function expectLearnerClean(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(TAP_A_CELL);
  expect(text).not.toMatch(DEV_LABELS);
}

async function expectFocusedHeading(page: Page, name: string | RegExp) {
  await expect(h2(page)).toHaveText(name);
  await expect(h2(page)).toBeFocused();
}

test.describe('Learner slice: the shared kitchen', () => {
  test('home leads straight into the encounter; no matrix or dev labels', async ({ page }) => {
    await page.goto('./#/');
    await expect(page.getByRole('heading', { name: 'STRATEGOS', exact: true })).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
    await expectLearnerClean(page);
    await page.getByRole('button', { name: 'Start' }).click();
    await expectFocusedHeading(page, 'The situation');
    await expect(page.getByTestId('role-statement')).toHaveText('You are Roommate A.');
    await expect(page.locator('[data-testid^="context-"]')).toHaveCount(10);
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByTestId('payoff-matrix')).toHaveCount(0);
    await expectLearnerClean(page);
  });

  test('encounter: story + at-a-glance + Continue fit a 390×844 screen; details collapsed and expandable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./#/');
    await page.getByRole('button', { name: 'Start' }).click();
    await expectFocusedHeading(page, 'The situation');
    await expect(page.getByTestId('context-situation')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('role-statement')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('glance')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport({ ratio: 1 });

    const details = page.locator('details.disclosure');
    await expect(details).toHaveCount(5);
    for (const d of await details.all()) {
      await expect(d).not.toHaveAttribute('open', /.*/);
      const box = await d.locator('summary').boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    const prefs = page.getByTestId('context-preferences');
    await expect(prefs.locator('p')).toBeHidden();
    await prefs.getByText('What you each care about').click();
    await expect(prefs).toHaveAttribute('open', '');
    await expect(prefs.locator('p')).toBeVisible();
    await expect(prefs.locator('p')).toContainText('feels unfair');
    await expect(prefs.locator('p')).not.toContainText(/best|worst/i);
    // Keyboard: focus a summary and toggle it with Enter.
    const known = page.getByTestId('context-knownUnknown');
    await known.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(known).toHaveAttribute('open', '');
    await expect(known.locator('p')).toContainText('don’t know what B will choose');
  });

  test('walks the full slice (seed 3: B leaves it) and saves the attempt', async ({ page }) => {
    await page.goto('./#/?seed=3');
    await page.getByRole('button', { name: 'Start' }).click();

    // 1 Encounter
    await expectFocusedHeading(page, 'The situation');
    await expect(page.locator('table')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue' }).click();

    // 2 Predict (actions only)
    await expectFocusedHeading(page, 'What do you predict Roommate B will choose?');
    const predict = page.getByRole('group', { name: /prediction/i });
    await expect(predict.getByRole('button')).toHaveText(['Clean', 'Leave it']);
    for (const b of await predict.getByRole('button').all()) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await predict.getByRole('button', { name: 'Leave it' }).click();

    // 3 Confidence
    await expectFocusedHeading(page, 'How confident are you that Roommate B will choose Leave it?');
    await page.locator('#confidence-slider').fill('80');
    await expect(page.getByTestId('confidence-control')).toContainText('80%');
    await expectLearnerClean(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    // 4 Decide (own actions only; no joint outcomes)
    await expectFocusedHeading(page, 'What will you choose?');
    const decide = page.getByRole('group', { name: 'Your choice' });
    await expect(decide.getByRole('button')).toHaveText(['Clean', 'Leave it']);
    await expect(page.locator('table')).toHaveCount(0);
    await decide.getByRole('button', { name: 'Leave it' }).click();

    // 5 Response: no Back after the reveal
    await expectFocusedHeading(page, 'Both choices are in');
    await expect(page.getByTestId('response-text')).toHaveText('You chose Leave it. Roommate B chose Leave it.');
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue' }).click();

    // 6 Outcome in words first
    await expectFocusedHeading(page, 'What happened');
    await expect(page.getByTestId('outcome-words')).toHaveText('You get 1. Roommate B gets 1.');
    await expect(page.getByTestId('outcome-story')).toContainText('You both left it');
    await expect(page.getByTestId('outcome-pair')).toHaveText('Outcome: (1, 1)');
    await expect(page.locator('table')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue' }).click();

    // 7 Matrix reveal: read-only
    await expectFocusedHeading(page, 'The whole situation');
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('button')).toHaveCount(0);
    await expect(table.getByRole('rowheader')).toHaveCount(2);
    await expect(page.getByTestId('realised-cell')).toContainText('1,1');
    await expect(page.getByTestId('matrix-landing')).toContainText('You chose the row “Leave it”. Roommate B chose the column “Leave it”.');
    await expectLearnerClean(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    // 8 Structured explanation
    await expectFocusedHeading(page, 'Check your reasoning');
    await expect(page.getByTestId('btn-continue')).toBeDisabled();
    await page.getByTestId('question-if-b-cleans').getByRole('button', { name: 'Leave it' }).click();
    await expect(page.getByTestId('feedback-if-b-cleans')).toContainText('Leave it gives you 5, Clean gives you 3');
    await page.getByTestId('question-if-b-leaves').getByRole('button', { name: 'Leave it' }).click();
    await expect(page.getByTestId('feedback-if-b-leaves')).toContainText('Leave it gives you 1, Clean gives you 0');
    await page.getByTestId('question-either-way').getByRole('button', { name: 'No, it depends' }).click();
    await expect(page.getByTestId('feedback-either-way')).toContainText('Not quite.');
    await expect(page.getByTestId('closing-note')).toContainText('you each get 1 instead of 3');
    await page.getByRole('button', { name: 'Continue' }).click();

    // 9 Summary
    await expectFocusedHeading(page, 'Summary');
    await expect(page.getByTestId('summary-prediction')).toContainText('80% confidence');
    await expect(page.getByTestId('summary-decision')).toContainText('That was the best reply to your own prediction.');
    await expect(page.getByTestId('summary-outcome')).toContainText('You got 1; Roommate B got 1.');
    await expect(page.getByTestId('summary-policy')).toContainText('Leave it 7 times in 10');
    await expect(page.getByTestId('save-note')).toContainText('saved on this device');
    await expectLearnerClean(page);

    await page.getByRole('button', { name: 'Try again' }).click();
    await expectFocusedHeading(page, 'The situation');

    // The record is visible on the data page.
    await page.getByRole('link', { name: 'Data & app' }).click();
    await expect(page.getByTestId('events-list')).toContainText('slice.attempt');
    await expectLearnerClean(page);
  });

  test('seed 1: B cleans; Back works only before the decision', async ({ page }) => {
    await page.goto('./#/?seed=1');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expectFocusedHeading(page, 'The situation');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Clean' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Clean' }).click();
    await expect(page.getByTestId('response-text')).toHaveText('You chose Clean. Roommate B chose Clean.');
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('outcome-words')).toHaveText('You get 3. Roommate B gets 3.');
  });

  test('developer route still works and is not linked from the learner UI', async ({ page }) => {
    await page.goto('./#/');
    await expect(page.locator('a[href*="dev"]')).toHaveCount(0);
    await page.goto('./#/dev');
    await expect(page.getByText('Developer mode')).toBeVisible();
    await expect(page.getByLabel('Payoff matrix demo')).toBeVisible();
    await expect(page.getByText(TAP_A_CELL)).toBeVisible();
    await expect(page.getByText('Debug: show engine output')).toBeVisible();
    await expect(page.getByTestId('btn-write-sample')).toBeVisible();
  });
});
