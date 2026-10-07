import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Developer mode (#/dev) smoke', () => {
  test('loads dev route via hash and shows the spike matrix', async ({ page }) => {
    await page.goto('./#/dev');
    await expect(page.getByRole('heading', { name: 'STRATEGOS', exact: true })).toBeVisible();
    await expect(page.getByLabel('Payoff matrix demo')).toBeVisible();
    await expect(page.getByText(/roommates deciding/i)).toBeVisible();
  });

  test('selects a matrix cell (dev spike only)', async ({ page }) => {
    await page.goto('./#/dev');
    await page.getByRole('button', { name: /Clean vs Leave it/i }).first().click();
    await expect(page.getByTestId('selection-readout')).toContainText('Selected:');
  });

  test('confidence control updates', async ({ page }) => {
    await page.goto('./#/dev');
    const slider = page.locator('#confidence-slider');
    await slider.fill('85');
    await expect(page.getByTestId('confidence-control')).toContainText('85%');
  });

  test('hash route stays on #/', async ({ page }) => {
    await page.goto('./#/');
    await expect(page).toHaveURL(/#\/$/);
  });

  test('engine debug output toggles', async ({ page }) => {
    await page.goto('./#/dev');
    await page.getByTestId('engine-debug-toggle').check();
    await expect(page.getByTestId('engine-debug')).toContainText('Row best reply vs Clean: Leave it');
  });

  test('write sample event and list it', async ({ page }) => {
    await page.goto('./#/dev');
    await page.getByTestId('btn-write-sample').click();
    await expect(page.getByTestId('events-list')).toContainText('phase0.sample');
  });

  test('export downloads learning JSON', async ({ page }) => {
    await page.goto('./#/dev');
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

test.describe('Phase 0 install', () => {
  test('manifest has stable id and scope', async ({ request }) => {
    const res = await request.get('./manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.id).toBe('/strategos/');
    expect(m.start_url).toBe('/strategos/');
    expect(m.scope).toBe('/strategos/');
  });

  test('Chromium: install card appears on beforeinstallprompt, prompts, hides after appinstalled', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'beforeinstallprompt is Chromium-only');
    await page.goto('./#/');
    await expect(page.getByTestId('install-card')).toHaveCount(0);
    await page.evaluate(() => {
      const w = window as unknown as { __prompted: number };
      w.__prompted = 0;
      const ev = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
      ev.prompt = () => {
        w.__prompted += 1;
        return Promise.resolve();
      };
      ev.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
      window.dispatchEvent(ev);
    });
    const card = page.getByTestId('install-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Install STRATEGOS' })).toBeVisible();
    await expect(card).toContainText('Add it to your home screen for full-screen, offline practice.');

    // Card is secondary: it sits after the Start button so it never competes with it.
    const cardBox = await card.boundingBox();
    const startBox = await page.getByTestId('btn-start').boundingBox();
    expect(cardBox!.y).toBeGreaterThan(startBox!.y);

    // Touch targets >= 44px.
    const cta = card.getByRole('button', { name: 'Install app' });
    const close = card.getByRole('button', { name: 'Dismiss install card' });
    for (const b of [cta, close]) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }

    await cta.click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);

    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(page.getByTestId('install-card')).toHaveCount(0);
    await expect(page.getByTestId('installed-status')).toBeVisible();
  });

  test('iOS: install card shows instructions and dismissal persists under namespaced key', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'iOS Safari path');
    await page.goto('./#/');
    const card = page.getByTestId('install-card');
    await expect(card).toBeVisible();
    const cta = card.getByRole('button', { name: 'Install app' });
    await expect(cta).toHaveAttribute('aria-expanded', 'false');
    await cta.click();
    await expect(cta).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('ios-install-steps')).toContainText('Share');
    await expect(page.getByTestId('ios-install-steps')).toContainText('Add to Home Screen');

    await card.getByRole('button', { name: 'Dismiss install card' }).click();
    await expect(page.getByTestId('install-card')).toHaveCount(0);
    const stored = await page.evaluate(() => localStorage.getItem('strategos:v1:installCardDismissedAt'));
    expect(Number(stored)).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'STRATEGOS', exact: true })).toBeVisible();
    await expect(page.getByTestId('install-card')).toHaveCount(0);

    // After 14 days the card returns.
    await page.evaluate(() =>
      localStorage.setItem(
        'strategos:v1:installCardDismissedAt',
        String(Date.now() - 15 * 24 * 60 * 60 * 1000),
      ),
    );
    await page.reload();
    await expect(page.getByTestId('install-card')).toBeVisible();
  });

  test('install troubleshooting help is present on the data page', async ({ page }) => {
    await page.goto('./#/');
    await page.getByRole('link', { name: 'Data & app' }).click();
    await expect(page).toHaveURL(/#\/data$/);
    await page.getByText('Install troubleshooting (Android)').click();
    await expect(page.getByTestId('install-help')).toContainText('app drawer');
  });
});
