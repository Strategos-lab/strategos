import { describe, expect, it } from 'vitest';
import { CONTEXT_FIELDS, RAW_SCENARIOS, SCENARIOS, validateScenario } from '..';

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
    expect(s.context.knownUnknown).toMatch(/don’t know what B will do/);
    expect(s.context.payoffMeaning).toMatch(/0–5 scale/);
    expect(s.context.payoffMeaning).toMatch(/not money/);
  });
});
