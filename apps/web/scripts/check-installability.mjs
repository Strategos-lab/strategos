// Headless Chromium installability check via CDP Page.getInstallabilityErrors.
// Usage: node scripts/check-installability.mjs [url]
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'https://strategos-lab.github.io/strategos/';
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return {
    scope: reg.scope,
    scriptURL: reg.active?.scriptURL ?? null,
    controlled: !!navigator.serviceWorker.controller,
  };
});

const cdp = await context.newCDPSession(page);
const inst = await cdp.send('Page.getInstallabilityErrors');
const errors = inst.installabilityErrors ?? inst.errors ?? [];
const manifest = await cdp.send('Page.getAppManifest');
let parsed = null;
try { parsed = JSON.parse(manifest.data ?? 'null'); } catch {}
let manifestId = null;
try { manifestId = (await cdp.send('Page.getAppId')); } catch (e) { manifestId = String(e); }

console.log(JSON.stringify({
  url,
  serviceWorker: sw,
  manifestUrl: manifest.url,
  manifestErrors: manifest.errors,
  manifestIdField: parsed?.id ?? '(none)',
  computedAppId: manifestId,
  installabilityErrors: errors,
  installable: errors.length === 0,
}, null, 2));
await browser.close();
process.exit(errors.length === 0 ? 0 : 1);
