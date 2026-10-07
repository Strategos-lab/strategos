import type { Rubric } from '../types.ts';

export interface SelfAssessment {
  /** Criterion ids the learner says their own-words answer meets. */
  claimedMet: string[];
}

export interface RubricResult {
  /** Shown to the learner as a reflection checklist. */
  checklist: { id: string; text: string; claimed: boolean }[];
  /**
   * Contribution to Understanding. Always 0: self-assessment never raises Understanding
   * (plan §3.6); only corroborating structured items can.
   */
  understandingDelta: 0;
}

export function assessOwnWords(rubric: Rubric, self: SelfAssessment): RubricResult {
  return {
    checklist: rubric.criteria.map((c) => ({ id: c.id, text: c.text, claimed: self.claimedMet.includes(c.id) })),
    understandingDelta: 0,
  };
}
