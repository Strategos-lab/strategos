/**
 * @strategos/engine — deterministic game-theory engine (single source of truth).
 * Pure functions, exact rational arithmetic, seeded randomness, no AI, no I/O.
 */
export { ENGINE_VERSION } from './version.js';
export * from './types.js';
export { Rational, r, sum, dot, maxOf, minOf, argmaxAll, type RationalLike, type RationalString } from './rational.js';
export { seedRng, nextUint32, nextBernoulli, nextInt, deriveSeed, normaliseSeed, type RngState, type Draw } from './rng.js';
export {
  validateGame,
  assertValidGame,
  GameValidationError,
  V1_PLAYER_COUNT,
  type ValidationIssue,
  type ValidationResult,
} from './validate.js';
export { makeNormalGame, type MatrixGame } from './compile.js';
export {
  initialState,
  playersToMove,
  legalActions,
  step,
  isTerminal,
  payoffs,
  DEFAULT_MAX_ROUNDS,
  type GameState,
  type NormalState,
  type Sequential2State,
  type RepeatedState,
  type RepeatedEndReason,
  type Move,
  type InitialStateOptions,
} from './state.js';
export { bestResponses, bestResponseTable, bestResponseToMixed, type BestResponseRow, type MixedBestResponse } from './bestResponse.js';
export { expectedPayoffs, pureAsMixed, type MixedProfile, type MixedProfileLike } from './expected.js';
export {
  dominance,
  iesds,
  iteratedWeakDominance,
  WEAK_DOMINANCE_WARNING,
  type ActionDominance,
  type PlayerDominance,
  type EliminationStep,
  type IteratedEliminationResult,
} from './dominance.js';
export {
  pureNash,
  solveEquilibria,
  supportEnumeration,
  checkNash,
  isNashEquilibrium,
  isDegenerate,
  indifference2x2,
  supportBestResponses,
  MAX_EXHAUSTIVE_ACTIONS,
  type EquilibriumSet,
  type NashContinuum,
  type NashCheck,
  type SupportEnumerationResult,
  type Indifference2x2,
  type IndifferenceSolution,
} from './equilibria.js';
export { paretoAnalysis, type ParetoAnalysis, type OutcomePareto } from './pareto.js';
export { classifyFamily, type GameFamily, type FamilyClassification, type RoleValues } from './classify.js';
export {
  decisionQuality,
  internalConsistency,
  outcomeQuality,
  equilibriumReference,
  type DecisionQuality,
  type DecisionClassification,
  type InternalConsistency,
  type OutcomeQuality,
  type EquilibriumReference,
} from './decision.js';
export { counterfactuals, type Counterfactuals, type CounterfactualRow } from './counterfactual.js';
export {
  toSimultaneous,
  followerBestResponses,
  backwardInduction,
  compareWithSimultaneous,
  type TieBreakPolicy,
  type SubgamePerfectEquilibrium,
  type BackwardInductionResult,
  type FirstMoverEffect,
  type SequentialComparison,
} from './sequential.js';
export {
  ALL_C,
  ALL_D,
  TIT_FOR_TAT,
  GRIM_TRIGGER,
  TIT_FOR_TWO_TATS,
  WIN_STAY_LOSE_SHIFT,
  STANDARD_STRATEGIES,
  BEHAVIOURAL_STRATEGY_NOTE,
  GRIM_TRIGGER_NOTE,
  randomStrategy,
  defaultRoles,
  simulateRepeated,
  expectedRepeatedPayoffs,
  grimTriggerThreshold,
  isGrimSustainable,
  finiteHorizonUnravelling,
  type RoleAction,
  type AutomatonState,
  type RepeatedStrategy,
  type ActionRoles,
  type RoundRecord,
  type UserPolicyFn,
  type UserSpec,
  type SimulationOptions,
  type RepeatedSimulation,
  type GrimThreshold,
  type GrimSustainability,
  type FiniteHorizonUnravelling,
} from './repeated.js';
export { toJSONValue, type Jsonify } from './serialise.js';
export {
  analyse,
  analyseExact,
  analyseMatrix,
  type AnalysisFacts,
  type AnalysisExact,
  type MatrixAnalysis,
  type SequentialAnalysis,
  type RepeatedAnalysis,
} from './analyse.js';
