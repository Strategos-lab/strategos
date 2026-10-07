import { evaluateClaim } from '../claims.ts';
import type { Instance } from '../instance.ts';
import { render, slotValue } from '../render.ts';
import { deriveSeed, nextInt, seedRng } from '@strategos/engine';
import type { ErrorCode, FeedbackKey, Item } from '../types.ts';

export type Response =
  | { type: 'reason_choice'; set: number; option: number }
  | { type: 'fill_in'; values: Record<string, string> };

export interface Diagnosis {
  correct: boolean;
  /** 'CORRECT' or the error code of the first wrong part. */
  code: ErrorCode | 'CORRECT';
}

/** Deterministic diagnosis (plan §7.6.4): engine claims and slot values only. */
export function diagnose(inst: Instance, r: Response): Diagnosis {
  const item = inst.item;
  if (r.type === 'reason_choice') {
    const opt = item.optionSets?.[r.set]?.[r.option];
    if (!opt) throw new Error(`${item.id}: no option ${r.set}/${r.option}`);
    return evaluateClaim(opt.claim, inst) ? { correct: true, code: 'CORRECT' } : { correct: false, code: opt.code };
  }
  for (const s of item.slots ?? []) {
    const given = (r.values[s.id] ?? '').trim();
    if (given === slotValue(s.answer, inst)) continue;
    const known = s.knownWrong.find((k) => slotValue(k.value, inst) === given);
    return { correct: false, code: known ? known.code : 'UNMATCHED' };
  }
  return { correct: true, code: 'CORRECT' };
}

export interface FeedbackMessage {
  /** Order: status → evidence → conclusion → terminology (Production Rules L). */
  status: 'correct' | 'not_quite';
  body: string;
  term?: string;
}

/** Keys applicable to an item: item-scoped keys win over the concept-wide ones. */
export function keysFor(lib: FeedbackKey[], item: Item): FeedbackKey[] {
  const all = lib.filter((k) => k.concept === item.concept && k.type === item.type);
  const scoped = all.filter((k) => k.items?.includes(item.id));
  return scoped.length > 0 ? scoped : all.filter((k) => !k.items);
}

export function feedbackKey(lib: FeedbackKey[], item: Item, code: string): FeedbackKey | undefined {
  return keysFor(lib, item).find((k) => k.code === code);
}

/** Pick a phrasing deterministically from the attempt seed (engine PRNG). */
export function feedbackFor(inst: Instance, d: Diagnosis, lib: FeedbackKey[], seed: number | string, disclosed: boolean): FeedbackMessage {
  const key = feedbackKey(lib, inst.item, d.code);
  if (!key) throw new Error(`${inst.item.id}: no feedback for ${d.code}`);
  const pick = nextInt(seedRng(deriveSeed(seed, 41)), key.phrasings.length).value;
  const body = render(key.phrasings[pick]!, inst, { facts: inst.item.facts, blanks: false });
  const msg: FeedbackMessage = { status: d.correct ? 'correct' : 'not_quite', body };
  if (disclosed && key.term) msg.term = render(key.term, inst, { facts: inst.item.facts, blanks: false });
  return msg;
}
