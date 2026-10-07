/**
 * Flow state machine for the learner slice. Pure: transition(scenario, state, event) → state.
 * Invalid events return the SAME state object (so callers/tests can detect rejection).
 *
 * Order: intro → encounter → predict → confidence → decide → response → outcome → matrix → explain → summary.
 * - Back is allowed only before the decision locks in (predict, confidence, decide).
 * - The only learner moves are single actions of the learner's own player; joint outcomes are never
 *   selectable. The opponent's action is drawn from the declared policy and the attempt seed.
 * - The outcome cell is resolved by the engine state machine.
 */
import type { Scenario } from '../content/schema';
import {
  learnerActions,
  opponentActions,
  questionOptions,
  resolveOutcome,
  sampleOpponentAction,
  type ResolvedOutcome,
} from './engineFacts';

export const STEPS = [
  'intro',
  'encounter',
  'predict',
  'confidence',
  'decide',
  'response',
  'outcome',
  'matrix',
  'explain',
  'summary',
] as const;
export type Step = (typeof STEPS)[number];

export const CONFIDENCE_MIN = 50;
export const CONFIDENCE_MAX = 100;
export const CONFIDENCE_STEP = 5;

export interface AttemptState {
  step: Step;
  seed: number | null;
  /** Predicted opponent action index. */
  prediction: number | null;
  /** Confidence in the prediction, percent. */
  confidence: number;
  /** Learner's locked-in action index. */
  choice: number | null;
  opponentAction: number | null;
  outcome: ResolvedOutcome | null;
  /** questionId → chosen option id (locked once answered). */
  answers: Record<string, string>;
  startedAt: string | null;
  decidedAt: string | null;
  completedAt: string | null;
}

export type SliceEvent =
  | { type: 'START'; seed: number; at: string }
  | { type: 'CONTINUE' }
  | { type: 'BACK' }
  | { type: 'PREDICT'; action: number }
  | { type: 'SET_CONFIDENCE'; value: number }
  | { type: 'CONFIRM_CONFIDENCE' }
  | { type: 'DECIDE'; action: number; at: string }
  | { type: 'ANSWER'; questionId: string; optionId: string }
  | { type: 'FINISH'; at: string }
  | { type: 'RESTART'; seed: number; at: string };

export function initialAttempt(): AttemptState {
  return {
    step: 'intro',
    seed: null,
    prediction: null,
    confidence: 75,
    choice: null,
    opponentAction: null,
    outcome: null,
    answers: {},
    startedAt: null,
    decidedAt: null,
    completedAt: null,
  };
}

const isIndex = (x: unknown, n: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < n;
const validSeed = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

function fresh(seed: number, at: string): AttemptState {
  return { ...initialAttempt(), step: 'encounter', seed, startedAt: at };
}

/** Steps after the decision has locked in: no Back, no changing earlier answers. */
export const isRevealed = (step: Step) => STEPS.indexOf(step) >= STEPS.indexOf('response');

export function allAnswered(s: Scenario, st: AttemptState): boolean {
  return s.questions.every((q) => q.id in st.answers);
}

export function transition(s: Scenario, st: AttemptState, ev: SliceEvent): AttemptState {
  switch (ev.type) {
    case 'START':
      return st.step === 'intro' && validSeed(ev.seed) ? fresh(ev.seed, ev.at) : st;
    case 'RESTART':
      return st.step === 'summary' && validSeed(ev.seed) ? fresh(ev.seed, ev.at) : st;
    case 'CONTINUE':
      switch (st.step) {
        case 'encounter':
          return { ...st, step: 'predict' };
        case 'response':
          return { ...st, step: 'outcome' };
        case 'outcome':
          return { ...st, step: 'matrix' };
        case 'matrix':
          return { ...st, step: 'explain' };
        default:
          return st;
      }
    case 'BACK':
      switch (st.step) {
        case 'predict':
          return { ...st, step: 'encounter' };
        case 'confidence':
          return { ...st, step: 'predict' };
        case 'decide':
          return { ...st, step: 'confidence' };
        default:
          return st;
      }
    case 'PREDICT':
      if (st.step !== 'predict' || !isIndex(ev.action, opponentActions(s).length)) return st;
      return { ...st, prediction: ev.action, step: 'confidence' };
    case 'SET_CONFIDENCE': {
      const v = ev.value;
      if (st.step !== 'confidence' || typeof v !== 'number' || !Number.isInteger(v)) return st;
      if (v < CONFIDENCE_MIN || v > CONFIDENCE_MAX || (v - CONFIDENCE_MIN) % CONFIDENCE_STEP !== 0) return st;
      return { ...st, confidence: v };
    }
    case 'CONFIRM_CONFIDENCE':
      return st.step === 'confidence' && st.prediction !== null ? { ...st, step: 'decide' } : st;
    case 'DECIDE': {
      if (st.step !== 'decide' || st.seed === null || st.prediction === null) return st;
      if (!isIndex(ev.action, learnerActions(s).length)) return st; // only one own action, never a cell
      const opponentAction = sampleOpponentAction(s, st.seed);
      const outcome = resolveOutcome(s, ev.action, opponentAction);
      return { ...st, step: 'response', choice: ev.action, opponentAction, outcome, decidedAt: ev.at };
    }
    case 'ANSWER': {
      if (st.step !== 'explain' || ev.questionId in st.answers) return st;
      const q = s.questions.find((x) => x.id === ev.questionId);
      if (!q || !questionOptions(s, q).some((o) => o.id === ev.optionId)) return st;
      return { ...st, answers: { ...st.answers, [ev.questionId]: ev.optionId } };
    }
    case 'FINISH':
      return st.step === 'explain' && allAnswered(s, st) ? { ...st, step: 'summary', completedAt: ev.at } : st;
    default:
      return st;
  }
}
