/// <reference types="node" />
/**
 * Banned-word / banned-topic lint for authored content, UI strings and documentation.
 *
 * Exemption is structural and narrow: only text between
 *   <!-- lint:banned-terms-definition:start --> … <!-- lint:banned-terms-definition:end -->
 * in a file listed in MARKER_ALLOWED_FILES is skipped (that is where the prohibited topics are
 * defined). Markers anywhere else, or unbalanced/nested markers, are lint errors.
 * This file and the hygiene tests define the list itself and are the only files not scanned.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const BANNED_TERMS =
  /\b(police|policing|patrol\w*|crime\w*|criminal\w*|suspects?|arrest\w*|jail\w*|detective\w*|officers?|cops?|enforcement|interrogat\w*|inspect\w*|offenders?|sheriff\w*|warrants?|convict\w*|sentenc\w*|prison(?!er'?s[ _-]dilemma|ers_dilemma)\w*|politic\w*|elections?|investigat\w*)\b/gi;

export const MARKER_START = '<!-- lint:banned-terms-definition:start -->';
export const MARKER_END = '<!-- lint:banned-terms-definition:end -->';

/** Repo-relative (POSIX) paths that may carry the definition markers. */
export const MARKER_ALLOWED_FILES = ['docs/STRATEGOS_PRODUCTION_RULES.md'];

/** Files that define the banned list itself (not scanned). */
export const LIST_DEFINITION_FILES = [
  'apps/web/src/lint/bannedTermsLint.ts',
  'apps/web/src/lint/__tests__/bannedTermsLint.test.ts',
  'apps/web/src/content/__tests__/content-hygiene.test.ts',
];

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
    ...walk(join(repo, 'docs')),
    join(repo, 'README.md'),
    join(repo, 'apps', 'web', 'README.md'),
    join(repo, 'apps', 'web', 'index.html'),
    join(repo, 'packages', 'engine', 'README.md'),
  ];
  return files.filter((f) => existsSync(f) && SCANNED_EXT.test(f) && !f.includes(`${sep}node_modules${sep}`));
}

export function lintRepo(repo: string): LintIssue[] {
  return lintTargets(repo).flatMap((abs) => {
    const file = relative(repo, abs).split(sep).join('/');
    if (LIST_DEFINITION_FILES.includes(file)) return [];
    return lintText(file, readFileSync(abs, 'utf8'));
  });
}
