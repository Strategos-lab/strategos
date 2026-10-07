/// <reference types="node" />
/**
 * Content and learner-UI hygiene (acts as lint rules for the web app):
 *  - authored content and slice docs stay in general-public fictional domains;
 *  - no Math.random anywhere in the web source (seeded engine PRNG only);
 *  - developer-facing labels never appear in learner-facing source.
 * (File name ends in hygiene.test.ts so the engine's vocabulary scan skips this list.)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(import.meta.dirname, '..', '..');
const repo = join(src, '..', '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const BANNED =
  /\b(police|policing|patrol\w*|crime\w*|criminal\w*|suspects?|arrest\w*|jail\w*|detective\w*|officers?|cops?|enforcement|interrogat\w*|inspect\w*|offenders?|sheriff\w*|warrants?|convict\w*|sentenc\w*|prison\w*|politic\w*|elections?|investigat\w*)\b/i;

describe('web content hygiene', () => {
  it('authored scenarios and slice docs contain no out-of-scope vocabulary', () => {
    const files = [
      ...walk(join(src, 'content', 'scenarios')).filter((f) => f.endsWith('.json')),
      join(repo, 'docs', 'slice-roommate.md'),
    ];
    expect(files.length).toBeGreaterThan(1);
    for (const f of files) expect(readFileSync(f, 'utf8'), relative(repo, f)).not.toMatch(BANNED);
  });

  it('never uses Math.random in web source', () => {
    for (const f of walk(src).filter((x) => /\.(ts|tsx)$/.test(x) && !x.endsWith('hygiene.test.ts'))) {
      expect(readFileSync(f, 'utf8'), relative(src, f)).not.toMatch(/Math\.random/);
    }
  });

  it('learner-facing source has no developer labels', () => {
    const learner = [
      'pages/SlicePage.tsx',
      'pages/DataPage.tsx',
      'components/StoragePanel.tsx',
      'components/ConfidenceControl.tsx',
      'content/scenarios/roommate-kitchen.json',
    ];
    const devOnly = /Phase 0 stub|calibration scoring|Demo only|Debug: show engine output|Tap a cell|Nash|equilibri/i;
    for (const rel of learner) {
      let text = readFileSync(join(src, rel), 'utf8');
      // StoragePanel keeps developer wording only inside its devTools branch.
      if (rel.endsWith('StoragePanel.tsx')) text = text.replace(/\{devTools \?[\s\S]*?\) : /g, '');
      expect(text, rel).not.toMatch(devOnly);
    }
  });
});
