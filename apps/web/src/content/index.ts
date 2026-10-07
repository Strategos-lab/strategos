import { assertValidScenario, type Scenario } from './schema';
import roommateKitchen from './scenarios/roommate-kitchen.json';

/** All authored scenarios (validated at load). */
export const SCENARIOS: readonly Scenario[] = [assertValidScenario(roommateKitchen)];

/** The first learner-facing experience. */
export const FIRST_SCENARIO: Scenario = SCENARIOS[0]!;

/** Raw (unvalidated) scenario data, for content tests. */
export const RAW_SCENARIOS: readonly unknown[] = [roommateKitchen];

export * from './schema';
