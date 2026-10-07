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

/** Learner-facing slice strings with the lesson step at which each appears (terminology gating). */
export function sliceTexts(slice: SliceData = ROOMMATE_SLICE, skin: Skin = ROOMMATE_SKIN): { step: Step; text: string; where: string }[] {
  const out: { step: Step; text: string; where: string }[] = [];
  const add = (step: Step, text: unknown, where: string) => {
    if (typeof text === 'string') out.push({ step, text, where: `slice:${slice.id}.${where}` });
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
  for (const q of slice.questions) for (const k of ['prompt', 'noneLabel', 'alwaysLabel']) add('explain', q[k], `questions.${String(q.id)}.${k}`);
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
