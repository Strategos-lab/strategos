/**
 * Roommate slice entry (`@strategos/content/slice`). Imports only the roommate structure, skin
 * and presentation, so the web bundle never carries module or held-out content.
 *
 * The scenario is composed from the shared content system: structure (payoffs) × skin (story,
 * labels, outcomes) × slice presentation (prompts, questions, feedback templates, policy).
 * Its output must equal the pre-Phase-2 scenario JSON exactly (fixture test).
 */
import roommate from '../data/roommate/roommate-kitchen.json';
import structures from '../data/structures.json';
import type { Skin, Structure, Step } from './types.ts';

export interface SliceData {
  id: string;
  contentVersion: string;
  lesson: string;
  structure: string;
  skin: string;
  roleStatement: string;
  context: Record<'players' | 'choices' | 'learnerControls' | 'opponentControls' | 'payoffMeaning' | 'task', string>;
  contextDetails?: Record<string, string>;
  timingKind: 'simultaneous';
  opponentPolicy: { kind: 'fixed-mixed'; probabilities: Record<string, string>; rngStream: number; description: string; rationale: string };
  prompts: Record<string, string>;
  matrix: { intro: string; howToRead: string[] };
  questions: Record<string, unknown>[];
  feedback: Record<string, string>;
  closingNote: string;
}

export const ROOMMATE_SKIN = roommate.skin as unknown as Skin;
export const ROOMMATE_SLICE = roommate.slice as unknown as SliceData;

export function sliceStructure(slice: SliceData = ROOMMATE_SLICE, all: Structure[] = structures as unknown as Structure[]): Structure {
  const s = all.find((x) => x.id === slice.structure);
  if (!s) throw new Error(`slice ${slice.id}: unknown structure ${slice.structure}`);
  return s;
}

/** Compose the slice scenario object consumed (and validated) by the web app. */
export function composeSliceScenario(slice: SliceData = ROOMMATE_SLICE, skin: Skin = ROOMMATE_SKIN, structure: Structure = sliceStructure(slice)): Record<string, unknown> {
  if (skin.id !== slice.skin) throw new Error(`slice ${slice.id}: skin ${skin.id} ≠ ${slice.skin}`);
  if (Object.keys(structure.params).length > 0) throw new Error('slice structures have fixed payoffs');
  const player = (role: 'you' | 'other', ids: string[]) => ({
    id: skin.roles[role].id,
    label: skin.roles[role].label,
    actions: ids.map((id) => ({ id, label: skin.actionLabels[id]! })),
  });
  const game = {
    kind: 'normal',
    schemaVersion: 1,
    id: slice.id,
    title: skin.title,
    players: [player('you', structure.actions.A), player('other', structure.actions.B)],
    payoffs: structure.actions.A.map((a) => structure.actions.B.map((b) => [...structure.payoffs[`${a}|${b}`]!])),
    payoffScale: structure.scale,
  };
  return {
    id: slice.id,
    contentVersion: slice.contentVersion,
    title: skin.title,
    roleStatement: slice.roleStatement,
    context: {
      situation: skin.situation,
      players: slice.context.players,
      preferences: skin.incentives[structure.id]!,
      choices: slice.context.choices,
      learnerControls: slice.context.learnerControls,
      opponentControls: slice.context.opponentControls,
      knownUnknown: skin.information,
      timing: skin.timing,
      payoffMeaning: slice.context.payoffMeaning,
      task: slice.context.task,
    },
    timingKind: slice.timingKind,
    game,
    opponentPolicy: slice.opponentPolicy,
    prompts: slice.prompts,
    outcomes: skin.outcomes,
    matrix: slice.matrix,
    questions: slice.questions,
    feedback: slice.feedback,
    closingNote: slice.closingNote,
    ...(slice.contextDetails ? { contextDetails: slice.contextDetails } : {}),
  };
}

/** Recall line used when the roommate scene returns as M3.1 (the learner already met best responses). */
export const M31_RECALL = 'Again, compare your choices within B’s choice.';

/** Engine-style statement of the learner's best responses, computed from the payoffs. */
export function bestResponseRecap(skin: Skin = ROOMMATE_SKIN, structure: Structure = sliceStructure()): string {
  const { A, B } = structure.actions;
  const best = B.map((b) => {
    const top = Math.max(...A.map((a) => Number(structure.payoffs[`${a}|${b}`]![0])));
    return A.filter((a) => Number(structure.payoffs[`${a}|${b}`]![0]) === top);
  });
  const uniq = best.every((x) => x.length === 1) ? new Set(best.map((x) => x[0]!)) : new Set<string>();
  const label = (id: string) => skin.actionLabels[id]!;
  if (uniq.size === 1) {
    const a = [...uniq][0]!;
    return `${label(a)} is your best response to ${B.map(label).join(' and also to ')}.`;
  }
  return B.map((b, i) => `Against ${label(b)}, your best response is ${best[i]!.map(label).join(' or ')}.`).join(' ');
}

/**
 * The roommate scene in its second role (M3.1, discovering dominance). Same matrix, policy,
 * questions and mechanics as the first experience; only two feedback strings change: the
 * best-response definition becomes a recall line, and the dominance explanation states the
 * learner's best responses without repeating the formal definition (the lesson reveal gives it).
 */
export function composeSliceM31(slice: SliceData = ROOMMATE_SLICE, skin: Skin = ROOMMATE_SKIN, structure: Structure = sliceStructure(slice)): Record<string, unknown> {
  const base = composeSliceScenario(slice, skin, structure);
  return {
    ...base,
    feedback: { ...slice.feedback, bestReplyDefinition: M31_RECALL, dominantWhy: `{lines} ${bestResponseRecap(skin, structure)}` },
  };
}

/** Learner-facing slice strings with the lesson step at which each appears (terminology gating). */
export function sliceTexts(slice: SliceData = ROOMMATE_SLICE, skin: Skin = ROOMMATE_SKIN): { step: Step; text: string; where: string; claim?: boolean }[] {
  const out: { step: Step; text: string; where: string; claim?: boolean }[] = [];
  const add = (step: Step, text: unknown, where: string, claim = false) => {
    if (typeof text === 'string') out.push({ step, text, where: `slice:${slice.id}.${where}`, ...(claim ? { claim: true } : {}) });
  };
  add('title', skin.title, 'title');
  add('title', slice.roleStatement, 'roleStatement');
  for (const [k, v] of Object.entries({ ...slice.context, situation: skin.situation, timing: skin.timing, knownUnknown: skin.information, preferences: skin.incentives[slice.structure] })) add('encounter', v, `context.${k}`);
  for (const [k, v] of Object.entries(slice.contextDetails ?? {})) add('encounter', v, `contextDetails.${k}`);
  add('predict', slice.prompts.predict, 'prompts.predict');
  add('confidence', slice.prompts.confidence, 'prompts.confidence');
  add('decide', slice.prompts.decide, 'prompts.decide');
  add('decide', slice.prompts.decideNote, 'prompts.decideNote');
  for (const [k, v] of Object.entries(skin.outcomes ?? {})) add('outcome', v, `outcomes.${k}`);
  add('matrix', slice.matrix.intro, 'matrix.intro');
  slice.matrix.howToRead.forEach((t, i) => add('matrix', t, `matrix.howToRead.${i}`));
  for (const q of slice.questions) for (const k of ['prompt', 'noneLabel', 'alwaysLabel']) add('explain', q[k], `questions.${String(q.id)}.${k}`, k !== 'prompt');
  for (const [k, v] of Object.entries(slice.feedback)) add('feedback', v, `feedback.${k}`);
  add('summary', slice.closingNote, 'closingNote');
  add('summary', slice.opponentPolicy.description, 'opponentPolicy.description');
  return out;
}

/** Numeric consistency between slice copy and the engine-facing data. */
export function sliceNumericIssues(slice: SliceData = ROOMMATE_SLICE, structure: Structure = sliceStructure(slice)): string[] {
  const out: string[] = [];
  const pct = [...slice.opponentPolicy.description.matchAll(/(\d+)%\s+([^,.]+)/g)];
  const labels = ROOMMATE_SKIN.actionLabels;
  const declared = Object.entries(slice.opponentPolicy.probabilities);
  if (pct.length !== declared.length) out.push('policy description must state one percentage per action');
  for (const [, n, label] of pct) {
    const id = Object.keys(labels).find((k) => labels[k] === label!.trim());
    const p = id ? slice.opponentPolicy.probabilities[id] : undefined;
    if (!p) { out.push(`policy description names unknown action "${label}"`); continue; }
    const [a, b = '1'] = p.split('/');
    if (Number(n) !== (Number(a) * 100) / Number(b)) out.push(`policy description says ${n}% ${label} but the policy has ${p}`);
  }
  const range = /(\d+)\s*[–-]\s*(\d+)\s+scale/.exec(slice.context.payoffMeaning);
  const vals = Object.values(structure.payoffs).flat().map(Number);
  if (!range) out.push('payoffMeaning must state the scale');
  else if (Number(range[1]) !== Math.min(...vals) || Number(range[2]) !== Math.max(...vals)) {
    out.push(`payoffMeaning states ${range[1]}–${range[2]} but payoffs span ${Math.min(...vals)}–${Math.max(...vals)}`);
  }
  return out;
}
