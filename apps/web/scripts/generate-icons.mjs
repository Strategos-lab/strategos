import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

const svg = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1a1f2e"/>
  <rect x="96" y="96" width="140" height="140" rx="12" fill="none" stroke="#c4a574" stroke-width="18"/>
  <rect x="276" y="96" width="140" height="140" rx="12" fill="none" stroke="#c4a574" stroke-width="18"/>
  <rect x="96" y="276" width="140" height="140" rx="12" fill="none" stroke="#c4a574" stroke-width="18"/>
  <rect x="276" y="276" width="140" height="140" rx="12" fill="#c4a574"/>
</svg>`;

writeFileSync(join(outDir, 'icon.svg'), svg(512));

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size)))
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
  // maskable: same art with safe padding
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;
  await sharp(Buffer.from(svg(inner)))
    .resize(inner, inner)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#1a1f2e' })
    .png()
    .toFile(join(outDir, `icon-maskable-${size}.png`));
}

console.log('Icons written to', outDir);
