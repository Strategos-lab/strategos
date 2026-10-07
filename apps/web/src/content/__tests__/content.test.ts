import { describe, expect, it } from 'vitest';
import { CONTEXT_FIELDS, RAW_SCENARIOS, SCENARIOS, contextFieldsAt, validateScenario, type Scenario } from '..';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
type Mutable = Record<string, unknown> & { context: Record<string, unknown> };

describe('scenario content validation', () => {
  it('has exactly ten required context items', () => {
    expect(CONTEXT_FIELDS.map((f) => f.key)).toEqual([
      'situation',
      'players',
      'preferences',
      'choices',
      'learnerControls',
      'opponentControls',
      'knownUnknown',
      'timing',
      'payoffMeaning',
      'task',
    ]);
  });

  it('every authored scenario is valid', () => {
    expect(SCENARIOS.length).toBeGreaterThan(0);
    for (const raw of RAW_SCENARIOS) expect(validateScenario(raw)).toEqual([]);
  });

  for (const raw of RAW_SCENARIOS) {
    for (const { key } of CONTEXT_FIELDS) {
      it(`fails when ${(raw as { id: string }).id} lacks context.${key}`, () => {
        const missing = clone(raw) as Mutable;
        delete missing.context[key];
        expect(validateScenario(missing).map((i) => i.path)).toContain(`context.${key}`);
        const blank = clone(raw) as Mutable;
        blank.context[key] = '   ';
        expect(validateScenario(blank).map((i) => i.path)).toContain(`context.${key}`);
      });
    }
  }

  it('fails without a context object, an outcome text, or a valid policy', () => {
    const base = RAW_SCENARIOS[0]!;
    const noCtx = clone(base) as Mutable;
    delete (noCtx as Record<string, unknown>).context;
    expect(validateScenario(noCtx).map((i) => i.path)).toContain('context');

    const noCell = clone(base) as Mutable & { outcomes: Record<string, string> };
    delete noCell.outcomes['leave|leave'];
    expect(validateScenario(noCell).map((i) => i.path)).toContain('outcomes.leave|leave');

    const badPolicy = clone(base) as Mutable & { opponentPolicy: { probabilities: Record<string, string> } };
    badPolicy.opponentPolicy.probabilities = { clean: '1/2', leave: '1/3' };
    expect(validateScenario(badPolicy).map((i) => i.path)).toContain('opponentPolicy.probabilities');

    const badQuestion = clone(base) as Mutable & { questions: { opponentAction?: string }[] };
    badQuestion.questions[0]!.opponentAction = 'nap';
    expect(validateScenario(badQuestion).map((i) => i.path)).toContain('questions.0.opponentAction');

    const badGame = clone(base) as Mutable & { game: { payoffs: unknown } };
    badGame.game.payoffs = [[['3', '3']]];
    expect(validateScenario(badGame).some((i) => i.path.startsWith('game'))).toBe(true);

    const extra = clone(base) as Mutable;
    extra.context.mood = 'sunny';
    expect(validateScenario(extra).map((i) => i.path)).toContain('context.mood');
    expect(validateScenario(null)).toHaveLength(1);
  });

  it('roommate scenario states the role and the payoffs as authored', () => {
    const s = SCENARIOS.find((x) => x.id === 'roommate-kitchen')!;
    expect(s.roleStatement).toBe('You are Roommate A.');
    expect(s.game.payoffs).toEqual([
      [['3', '3'], ['0', '5']],
      [['5', '0'], ['1', '1']],
    ]);
    expect(s.opponentPolicy.probabilities).toEqual({ clean: '3/10', leave: '7/10' });
    expect(s.context.knownUnknown).toMatch(/don’t know what B will choose/);
    expect(s.context.knownUnknown).toMatch(/understand what is at stake for each other/);
    expect(s.context.payoffMeaning).toMatch(/0–5 scale/);
    expect(s.context.payoffMeaning).toMatch(/not money/);
  });
});

describe('encounter layout and wording', () => {
  it('places all ten items: story (1), at-a-glance (4), collapsed details (5)', () => {
    expect(contextFieldsAt('story').map((f) => f.key)).toEqual(['situation']);
    expect(contextFieldsAt('glance').map((f) => f.key)).toEqual(['players', 'choices', 'timing', 'task']);
    expect(contextFieldsAt('details').map((f) => f.key)).toEqual([
      'preferences',
      'learnerControls',
      'opponentControls',
      'knownUnknown',
      'payoffMeaning',
    ]);
    const placed = [...contextFieldsAt('story'), ...contextFieldsAt('glance'), ...contextFieldsAt('details')];
    expect(new Set(placed.map((f) => f.key)).size).toBe(CONTEXT_FIELDS.length);
    for (const f of CONTEXT_FIELDS) expect(f.shortLabel.length).toBeLessThanOrEqual(28);
  });

  // Small authored ban list: copy shown before the reasoning questions must not rank outcomes or
  // say one action is better regardless; the learner infers that from motivations and the table.
  const RANKING_WORDS = /\b(best|worst|next best|better|worse|prefer\w*|most|least|ideal|optimal|rather|regardless|either way|whatever)\b/i;

  const preRevealCopy = (s: Scenario): [string, string][] => [
    ['roleStatement', s.roleStatement],
    ...CONTEXT_FIELDS.map(({ key }) => [`context.${key}`, s.context[key]] as [string, string]),
    ...Object.entries(s.prompts).map(([k, v]) => [`prompts.${k}`, v] as [string, string]),
    ...Object.entries(s.outcomes).map(([k, v]) => [`outcomes.${k}`, v] as [string, string]),
    ['matrix.intro', s.matrix.intro],
    ...s.matrix.howToRead.map((t, i) => [`matrix.howToRead.${i}`, t] as [string, string]),
  ];

  it('the ban list catches the old ranked wording', () => {
    expect('Best for you: B cleans and you don’t. Next best: you both clean.').toMatch(RANKING_WORDS);
    expect('Worst: you clean alone.').toMatch(RANKING_WORDS);
  });

  for (const s of SCENARIOS) {
    it(`${s.id}: encounter and pre-reasoning copy contains no ranking words`, () => {
      for (const [path, text] of preRevealCopy(s)) expect(text, path).not.toMatch(RANKING_WORDS);
    });
  }

  it('outcome stories are observational (no editorial verdict words)', () => {
    const BANNED_OUTCOME = /\b(fair|decent|enjoyed it for free|good outcome|bad outcome|spotless)\b/i;
    for (const s of SCENARIOS) {
      for (const [cell, text] of Object.entries(s.outcomes)) {
        expect(text, `${s.id} outcomes.${cell}`).not.toMatch(BANNED_OUTCOME);
      }
    }
  });

  it('roommate motivations are qualitative and consistent with the payoffs', () => {
    const s = SCENARIOS.find((x) => x.id === 'roommate-kitchen')!;
    const p = s.context.preferences;
    expect(p).toMatch(/clean kitchen/);
    expect(p).toMatch(/effort/);
    expect(p).toMatch(/unfair/);
    expect(p).toMatch(/same kinds of feelings/);
    // "Cleaning while the other relaxes feels unfair" must match the lone cleaner's lowest number.
    const lone = s.game.payoffs[0]![1]![0]!; // A cleans, B leaves it
    const all = s.game.payoffs.flat().map((c) => Number(c[0]));
    expect(Number(lone)).toBe(Math.min(...all));
    // "Both want a clean kitchen": both cleaning beats both leaving it, for each person.
    expect(Number(s.game.payoffs[0]![0]![0])).toBeGreaterThan(Number(s.game.payoffs[1]![1]![0]));
    expect(Number(s.game.payoffs[0]![0]![1])).toBeGreaterThan(Number(s.game.payoffs[1]![1]![1]));
  });
});
