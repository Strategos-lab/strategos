// Walk the learner slice at a mobile viewport and screenshot every step.
// Usage: node scripts/slice-shots.mjs <baseURL> <outDir> [seed]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'https://strategos-lab.github.io/strategos/';
const out = process.argv[3] ?? 'slice-shots';
const seed = process.argv[4] ?? '3';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const shot = async (name) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, name), fullPage: true });
  console.log('shot', name, '—', (await page.locator('#step-heading').innerText().catch(() => '')).trim());
};
const cont = () => page.getByRole('button', { name: 'Continue' }).click();

await page.goto(`${base}#/?seed=${seed}`);
await page.getByRole('button', { name: 'Start' }).click();
await shot('01-encounter.png');
if ((await page.locator('table').count()) !== 0) throw new Error('matrix visible on encounter');
await cont();
await shot('02-predict.png');
await page.getByRole('group', { name: /prediction/i }).getByRole('button', { name: 'Leave it' }).click();
await page.locator('#confidence-slider').fill('80');
await shot('03-confidence.png');
await cont();
await shot('04-decide.png');
await page.getByRole('group', { name: 'Your choice' }).getByRole('button', { name: 'Clean' }).click();
await shot('05-response.png');
await cont();
await shot('06-outcome.png');
await cont();
await shot('07-matrix.png');
await cont();
await page.getByTestId('question-if-b-cleans').getByRole('button', { name: 'Leave it' }).click();
await page.getByTestId('question-if-b-leaves').getByRole('button', { name: 'Leave it' }).click();
await page.getByTestId('question-either-way').getByRole('button', { name: 'Leave it' }).click();
await shot('08-explain.png');
await cont();
await page.getByTestId('save-note').waitFor();
await shot('09-summary.png');
const body = await page.locator('body').innerText();
for (const bad of [/Tap a cell/i, /Phase 0 stub/i, /calibration scoring/i, /Demo only/i, /Debug: show engine output/i]) {
  if (bad.test(body)) throw new Error(`dev label visible: ${bad}`);
}
await browser.close();
console.log('ok');
