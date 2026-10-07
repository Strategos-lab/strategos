import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDependencies } from './check-dependencies.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const fx = (n) => join(here, 'fixtures', n);

test('an approved workspace passes (internal workspace deps allowed)', () => {
  assert.deepEqual(checkDependencies(fx('ok')).errors, []);
});

test('an unapproved production or dev dependency fails', () => {
  const { errors } = checkDependencies(fx('bad'));
  assert.equal(errors.length, 2);
  assert.match(errors.join('\n'), /production dependency "left-pad" is not in the allow-list/);
  assert.match(errors.join('\n'), /dev dependency "some-ai-sdk" is not in the allow-list/);
});

test('a dev-only approval does not cover a production dependency', () => {
  assert.match(checkDependencies(fx('devonly')).errors.join(), /"typescript" is approved for development only/);
});

test('the CLI exits non-zero on failure and zero on success', () => {
  const cli = join(here, 'check-dependencies.mjs');
  assert.throws(() => execFileSync('node', [cli, '--root', fx('bad')], { stdio: 'pipe' }));
  assert.match(execFileSync('node', [cli, '--root', fx('ok')]).toString(), /OK/);
});

test('the real repository passes', () => {
  const { files, errors } = checkDependencies(join(here, '..'));
  assert.deepEqual(errors, []);
  assert.ok(files.includes(join('packages', 'content', 'package.json')));
});
