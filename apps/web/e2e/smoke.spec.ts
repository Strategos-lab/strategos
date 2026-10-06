import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Phase 0 smoke', () => {
  test('loads home via hash route and shows matrix', async ({ page }) => {
    await page.goto('./#/');
    await expect(page.getByRole('heading', { name: 'STRATEGOS' })).toBeVisible();
    await expect(page.getByLabel('Payoff matrix demo')).toBeVisible();
    await expect(page.getByText(/roommates deciding/i)).toBeVisible();
  });

  test('selects a matrix cell', async ({ page }) => {
    await page.goto('./#/');
    await page.getByRole('button', { name: /Clean vs Leave it/i }).first().click();
    await expect(page.getByTestId('selection-readout')).toContainText('Selected:');
  });

  test('confidence control updates', async ({ page }) => {
    await page.goto('./#/');
    const slider = page.locator('#confidence-slider');
    await slider.fill('85');
    await expect(page.getByTestId('confidence-control')).toContainText('85%');
  });

  test('hash route stays on #/', async ({ page }) => {
    await page.goto('./#/');
    await expect(page).toHaveURL(/#\/$/);
  });

  test('write sample event and list it', async ({ page }) => {
    await page.goto('./#/');
    await page.getByTestId('btn-write-sample').click();
    await expect(page.getByTestId('events-list')).toContainText('phase0.sample');
  });

  test('export downloads learning JSON', async ({ page }) => {
    await page.goto('./#/');
    await page.getByTestId('btn-write-sample').click();
    await expect(page.getByTestId('events-list')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('btn-export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/strategos-learning-.*\.json/);

    const target = path.join(__dirname, '..', 'test-results', download.suggestedFilename());
    await download.saveAs(target);
  });
});
