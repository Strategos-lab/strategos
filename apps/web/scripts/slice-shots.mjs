// Walk the learner slice at 390×844 and screenshot every step (full page).
// Usage: node scripts/slice-shots.mjs <baseURL> <outDir> [seed]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'https://strategos-lab.github.io/strategos/';
const out = process.argv[3] ?? 'slice-shots';
const seed = process.argv[4] ?? '3';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const external = [];
const origin = new URL(base).origin;
page.on('request', (r) => {
  const u = new URL(r.url());
  if (!['data:', 'blob:'].includes(u.protocol) && u.origin !== origin) external.push(r.url());
});
const shot = async (name) => {
  await page.waitForTimeout(500); // let step / reveal motion settle
  await page.screenshot({ path: join(out, name), fullPage: true });
  console.log('shot', name, '—', (await page.locator('#step-heading').innerText().catch(() => '')).trim());
};
const cont = () => page.getByRole('button', { name: 'Continue' }).click();

await page.goto(`${base}#/?seed=${seed}`);
await page.evaluate(() => document.fonts.ready);
await page.getByRole('button', { name: 'Start' }).click();
await shot('01-encounter.png');
if ((await page.locator('table').count()) !== 0) throw new Error('matrix visible on encounter');
await page.getByTestId('context-preferences').locator('summary').click();
await shot('01b-encounter-expanded.png');
await cont();
await shot('02-predict.png');
await page.getByRole('group', { name: /prediction/i }).getByRole('button', { name: 'Leave it' }).click();
await page.getByRole('button', { name: 'Back' }).click(); // prediction is kept: shows the selected state
await shot('02b-predict-selected.png');
await page.getByRole('group', { name: /prediction/i }).getByRole('button', { name: 'Leave it' }).click();
await page.locator('#confidence-slider').fill('70');
await shot('03-confidence.png');
await cont();
await shot('04-decide.png');
await page.getByRole('group', { name: 'Your choice' }).getByRole('button', { name: 'Leave it' }).click();
await shot('05-response.png');
await cont();
await shot('06-outcome.png');
await cont();
await shot('07-matrix.png');
await cont();
await page.getByTestId('question-if-b-cleans').getByRole('button', { name: 'Leave it' }).click();
await page.getByTestId('question-if-b-leaves').getByRole('button', { name: 'Clean' }).click();
await shot('08-reasoning.png');
await page.getByTestId('question-either-way').getByRole('button', { name: 'Leave it is always better.' }).click();
await cont();
await page.getByTestId('save-note').waitFor();
await shot('09-summary.png');
const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
console.log('fonts loaded:', [...new Set(fonts)].join(', '));
const body = await page.locator('body').innerText();
for (const bad of [/Tap a cell/i, /Phase 0 stub/i, /calibration scoring/i, /Demo only/i, /Debug: show engine output/i]) {
  if (bad.test(body)) throw new Error(`dev label visible: ${bad}`);
}
if (external.length) throw new Error('external requests: ' + external.join(', '));
console.log('no external requests');
await browser.close();
console.log('ok');
