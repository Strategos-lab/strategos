import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOMMATE_SLICE, composeSliceScenario, sliceNumericIssues, sliceStructure } from '../src/slice.ts';

const legacy = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/roommate-kitchen.legacy.json'), 'utf8'));

describe('roommate slice migration', () => {
  it('composes exactly the pre-Phase-2 scenario (behaviour identical)', () => {
    expect(composeSliceScenario()).toEqual(legacy);
  });
  it('keeps the fixed payoffs and the 7/10 Leave it, 3/10 Clean policy', () => {
    expect(sliceStructure().payoffs).toEqual({ 'clean|clean': ['3', '3'], 'clean|leave': ['0', '5'], 'leave|clean': ['5', '0'], 'leave|leave': ['1', '1'] });
    expect(ROOMMATE_SLICE.opponentPolicy.probabilities).toEqual({ clean: '3/10', leave: '7/10' });
  });
  it('copy numbers agree with the data (policy percentages, payoff scale)', () => {
    expect(sliceNumericIssues()).toEqual([]);
    const bad = structuredClone(ROOMMATE_SLICE);
    bad.opponentPolicy.description = 'Fixed for this exercise: 60% Leave it, 40% Clean.';
    expect(sliceNumericIssues(bad).join()).toMatch(/60% Leave it/);
    bad.context.payoffMeaning = 'Each outcome gets a number on a 0–9 scale.';
    expect(sliceNumericIssues(bad).join()).toMatch(/0–9/);
  });
});
