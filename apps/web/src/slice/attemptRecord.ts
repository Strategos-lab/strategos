import { ENGINE_VERSION } from '@strategos/engine';
import type { Scenario } from '../content/schema';
import { writeLearningEvent, type LearningEvent } from '../storage';
import { correctOptions, decisionConsistency, learnerActions, opponentActions } from './engineFacts';
import type { AttemptState } from './machine';

export const ATTEMPT_EVENT_TYPE = 'slice.attempt';

/** Build the learning event for a completed attempt (no personal data; device-only). */
export function buildAttemptEvent(s: Scenario, st: AttemptState): Omit<LearningEvent, 'id'> {
  if (st.step !== 'summary' || st.prediction === null || st.choice === null || st.opponentAction === null || !st.outcome) {
    throw new Error('attempt is not complete');
  }
  const own = learnerActions(s);
  const opp = opponentActions(s);
  const consistency = decisionConsistency(s, st.prediction, st.confidence, st.choice);
  return {
    type: ATTEMPT_EVENT_TYPE,
    createdAt: st.completedAt!,
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    contentVersion: s.contentVersion,
    payload: {
      scenarioId: s.id,
      seed: st.seed,
      opponentPolicy: { kind: s.opponentPolicy.kind, probabilities: s.opponentPolicy.probabilities, rngStream: s.opponentPolicy.rngStream },
      prediction: opp[st.prediction]!.id,
      confidencePct: st.confidence,
      choice: own[st.choice]!.id,
      opponentAction: opp[st.opponentAction]!.id,
      outcomePayoffs: st.outcome.payoffs,
      consistentWithOwnPrediction: consistency.consistent,
      answers: Object.fromEntries(
        s.questions.map((q) => [q.id, { answer: st.answers[q.id] ?? null, correct: correctOptions(s, q).includes(st.answers[q.id] ?? '') }]),
      ),
      startedAt: st.startedAt,
      decidedAt: st.decidedAt,
      completedAt: st.completedAt,
    },
  };
}

export async function persistAttempt(s: Scenario, st: AttemptState): Promise<number> {
  return writeLearningEvent(buildAttemptEvent(s, st));
}
