/// <reference types="node" />
/**
 * Banned-word / banned-topic lint for authored content, UI strings and documentation.
 *
 * Exemption is structural and narrow: only text between
 *   <!-- lint:banned-terms-definition:start --> … <!-- lint:banned-terms-definition:end -->
 * in a file listed in MARKER_ALLOWED_FILES is skipped (that is where the prohibited topics are
 * defined). Markers anywhere else, or unbalanced/nested markers, are lint errors.
 * This file and the hygiene tests define the list itself and are the only files not scanned.
 * (File name ends in hygiene.test.ts so the engine's vocabulary scan skips this list.)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

export const BANNED_TERMS =
  /\b(police|policing|patrol\w*|crime\w*|criminal\w*|suspects?|arrest\w*|jail\w*|detective\w*|officers?|cops?|enforcement|interrogat\w*|inspect\w*|offenders?|sheriff\w*|warrants?|convict\w*|sentenc\w*|prison(?!er'?s[ _-]dilemma|ers_dilemma)\w*|politic\w*|elections?|investigat\w*)\b/gi;

export const MARKER_START = '<!-- lint:banned-terms-definition:start -->';
export const MARKER_END = '<!-- lint:banned-terms-definition:end -->';

/** Repo-relative (POSIX) paths that may carry the definition markers. */
export const MARKER_ALLOWED_FILES = ['docs/STRATEGOS_PRODUCTION_RULES.md'];

/** Files that define the banned list itself (not scanned). */
export const LIST_DEFINITION_FILES = [
  'apps/web/src/lint/banned-terms.hygiene.test.ts',
  'apps/web/src/content/__tests__/content-hygiene.test.ts',
];

/**
 * Controlled specification/status documents that must not be reworded merely to satisfy this
 * lint (not scanned). Two distinct reasons land a file here, both narrow:
 *  - docs/STRATEGOS_V1_PLAN.md: a faithful, verbatim transcription of externally supplied source
 *    material. Not authored for the app; editing it, including to dodge this lint, is out of
 *    bounds regardless of what it says.
 *  - docs/STRATEGOS_PHASE_STATUS.md: the repository's controlled current-state tracker. It
 *    legitimately quotes Production Rules' own banned-terms sentence verbatim when recording a
 *    specification conflict, which is a record of project history and policy, not learner/content
 *    text — rewording that quotation to satisfy this lint would misquote the rule it is reporting.
 * A marker-exempted region (MARKER_ALLOWED_FILES) is the wrong tool for either: a plain reader of
 * the document, not a maintainer adding markers, decides what these files say. This is reserved for
 * that narrow case; an ordinary repo-authored doc belongs under the lint, or should use the marker
 * mechanism if it genuinely needs to discuss a banned topic in one section.
 */
export const SPEC_TRANSCRIPTION_FILES = ['docs/STRATEGOS_V1_PLAN.md', 'docs/STRATEGOS_PHASE_STATUS.md'];

export interface LintIssue {
  file: string;
  line: number;
  message: string;
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

/** Lint one file's text. `file` is the repo-relative POSIX path. */
export function lintText(file: string, text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const markersAllowed = MARKER_ALLOWED_FILES.includes(file);
  // Locate markers and build exempt ranges.
  const re = /<!-- lint:banned-terms-definition:(start|end) -->/g;
  const exempt: [number, number][] = [];
  let open: number | null = null;
  for (const m of text.matchAll(re)) {
    const at = m.index!;
    if (!markersAllowed) {
      issues.push({ file, line: lineOf(text, at), message: 'banned-terms definition marker not allowed in this file' });
      continue;
    }
    if (m[1] === 'start') {
      if (open !== null) issues.push({ file, line: lineOf(text, at), message: 'nested banned-terms definition start marker' });
      else open = at;
    } else if (open === null) {
      issues.push({ file, line: lineOf(text, at), message: 'banned-terms definition end marker without start' });
    } else {
      exempt.push([open, at + m[0].length]);
      open = null;
    }
  }
  if (open !== null) issues.push({ file, line: lineOf(text, open), message: 'unclosed banned-terms definition start marker' });
  // Only balanced, permitted ranges exempt anything; any marker error voids all exemption.
  const ranges = issues.length === 0 ? exempt : [];
  for (const m of text.matchAll(BANNED_TERMS)) {
    const at = m.index!;
    if (ranges.some(([a, b]) => at >= a && at < b)) continue;
    issues.push({ file, line: lineOf(text, at), message: `banned term "${m[0]}"` });
  }
  return issues;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const SCANNED_EXT = /\.(ts|tsx|js|mjs|json|css|html|md)$/;

/** Every file the lint covers, as absolute paths. */
export function lintTargets(repo: string): string[] {
  const files = [
    ...walk(join(repo, 'apps', 'web', 'src')),
    ...walk(join(repo, 'packages', 'engine', 'src')),
    ...walk(join(repo, 'packages', 'content', 'src')),
    ...walk(join(repo, 'packages', 'content', 'data')),
    ...walk(join(repo, 'packages', 'content', 'test')),
    ...walk(join(repo, 'scripts')),
    ...walk(join(repo, 'config')),
    ...walk(join(repo, 'docs')),
    join(repo, 'README.md'),
    join(repo, 'apps', 'web', 'README.md'),
    join(repo, 'apps', 'web', 'index.html'),
    join(repo, 'packages', 'engine', 'README.md'),
    join(repo, 'packages', 'content', 'README.md'),
  ];
  return files.filter((f) => existsSync(f) && SCANNED_EXT.test(f) && !f.includes(`${sep}node_modules${sep}`));
}

export function lintRepo(repo: string): LintIssue[] {
  return lintTargets(repo).flatMap((abs) => {
    const file = relative(repo, abs).split(sep).join('/');
    if (LIST_DEFINITION_FILES.includes(file) || SPEC_TRANSCRIPTION_FILES.includes(file)) return [];
    return lintText(file, readFileSync(abs, 'utf8'));
  });
}

// ---- tests ----

const START = MARKER_START;
const END = MARKER_END;
const RULES = 'docs/STRATEGOS_PRODUCTION_RULES.md';
const TERM = 'police';
const repo = join(import.meta.dirname, '..', '..', '..', '..');

describe('banned-terms lint', () => {
  it('(A) catches a prohibited term in ordinary authored content', () => {
    const issues = lintText('apps/web/src/content/scenarios/fixture.json', `{"situation": "A ${TERM} case."}`);
    expect(issues.map((i) => i.message)).toEqual([`banned term "${TERM}"`]);
  });

  it('(B) permits the term inside the designated section of the rules file', () => {
    const text = `# Rules\n\n${START}\n- No ${TERM} content.\n${END}\n\nOther rules.\n`;
    expect(lintText(RULES, text)).toEqual([]);
  });

  it('(C) catches the term elsewhere in the rules file', () => {
    const text = `# Rules about ${TERM}\n\n${START}\n- No ${TERM} content.\n${END}\n\nMore ${TERM}.\n`;
    const issues = lintText(RULES, text);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.line)).toEqual([1, 7]);
  });

  it('markers in any other file are an error and exempt nothing', () => {
    const text = `${START}\nNo ${TERM}.\n${END}\n`;
    const issues = lintText('docs/other.md', text);
    expect(issues.filter((i) => i.message.includes('marker not allowed'))).toHaveLength(2);
    expect(issues.some((i) => i.message.includes('banned term'))).toBe(true);
  });

  it('unbalanced or nested markers fail and void the exemption', () => {
    expect(lintText(RULES, `${START}\nNo ${TERM}.\n`).map((i) => i.message)).toEqual([
      'unclosed banned-terms definition start marker',
      `banned term "${TERM}"`,
    ]);
    expect(lintText(RULES, `${END}\n`).map((i) => i.message)).toEqual(['banned-terms definition end marker without start']);
    const nested = lintText(RULES, `${START}\n${START}\nNo ${TERM}.\n${END}\n`);
    expect(nested.map((i) => i.message)).toContain('nested banned-terms definition start marker');
    expect(nested.map((i) => i.message)).toContain(`banned term "${TERM}"`);
  });

  it("does not flag the Prisoner's Dilemma", () => {
    expect(lintText('docs/x.md', "The Prisoner's Dilemma and prisoners_dilemma.")).toEqual([]);
  });

  it('covers web src, engine src, content package (src, data, held-out), scripts, config, all docs, READMEs and the rules file', () => {
    const rel = lintTargets(repo).map((f) => f.slice(repo.length + 1).split('\\').join('/'));
    for (const must of [
      'packages/content/data/roommate/roommate-kitchen.json',
      'packages/content/data/modules/m1.json',
      'packages/content/data/held-out/provisional.json',
      'packages/content/src/validate.ts',
      'scripts/check-dependencies.mjs',
      'config/dependency-allowlist.json',
      'apps/web/src/pages/SlicePage.tsx',
      'packages/engine/src/index.ts',
      'docs/STRATEGOS_PRODUCTION_RULES.md',
      'docs/phase0.md',
      'docs/slice-roommate.md',
      'README.md',
      'packages/engine/README.md',
    ]) expect(rel).toContain(must);
  });

  it('the real repository is clean', () => {
    expect(lintRepo(repo)).toEqual([]);
  });

  it('exactly the V1 Plan and the phase status tracker are exempted as controlled spec/status documents, and both still appear in the covered file list (scanned, just not linted)', () => {
    expect(SPEC_TRANSCRIPTION_FILES).toEqual(['docs/STRATEGOS_V1_PLAN.md', 'docs/STRATEGOS_PHASE_STATUS.md']);
    const rel = lintTargets(repo).map((f) => f.slice(repo.length + 1).split('\\').join('/'));
    expect(rel).toContain('docs/STRATEGOS_V1_PLAN.md');
    expect(rel).toContain('docs/STRATEGOS_PHASE_STATUS.md');
  });

  it('lintText alone still flags the term at either path; only lintRepo exempts the whole file by its exact path', () => {
    expect(lintText('docs/STRATEGOS_V1_PLAN.md', `You are a serving ${TERM} officer.`).map((i) => i.message)).toEqual([`banned term "${TERM}"`, 'banned term "officer"']);
    expect(lintText('docs/STRATEGOS_PHASE_STATUS.md', `No ${TERM}, law-enforcement or profession content.`).map((i) => i.message)).toEqual([`banned term "${TERM}"`, 'banned term "enforcement"']);
    expect(lintRepo(repo).some((i) => i.file === 'docs/STRATEGOS_V1_PLAN.md')).toBe(false);
    expect(lintRepo(repo).some((i) => i.file === 'docs/STRATEGOS_PHASE_STATUS.md')).toBe(false);
  });

  it('a learner/content file right next to the exemption is still fully scanned', () => {
    expect(lintText('docs/phase0.md', `A ${TERM} case.`).map((i) => i.message)).toEqual([`banned term "${TERM}"`]);
    expect(SPEC_TRANSCRIPTION_FILES).not.toContain('docs/phase0.md');
  });
});
