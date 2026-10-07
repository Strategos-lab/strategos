/// <reference types="node" />
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKER_END as END, MARKER_START as START, lintRepo, lintTargets, lintText } from '../bannedTermsLint';

const RULES = 'docs/STRATEGOS_PRODUCTION_RULES.md';
const TERM = 'police';
const repo = join(import.meta.dirname, '..', '..', '..', '..', '..');

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

  it('covers web src (incl. scenarios), engine src, all docs, READMEs and the rules file', () => {
    const rel = lintTargets(repo).map((f) => f.slice(repo.length + 1).split('\\').join('/'));
    for (const must of [
      'apps/web/src/content/scenarios/roommate-kitchen.json',
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
});
