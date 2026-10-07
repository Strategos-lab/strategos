// Reports the engine's minified + gzipped bundle size (budget: 40 KB gzipped, plan §7.9).
import { rolldown } from 'rolldown';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const BUDGET_GZIP = 40 * 1024;
const input = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const bundle = await rolldown({ input, treeshake: false });
const { output } = await bundle.generate({ format: 'esm', minify: true });
const code = output[0].code;
const raw = Buffer.byteLength(code);
const gz = gzipSync(code, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`@strategos/engine (whole API, minified): ${kb(raw)} raw, ${kb(gz)} gzipped (budget ${kb(BUDGET_GZIP)} gzipped)`);
if (gz > BUDGET_GZIP) {
  console.error('Engine bundle exceeds its gzipped size budget.');
  process.exit(1);
}
