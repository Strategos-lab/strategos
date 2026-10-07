/** The authored content bundle (practice) and the provisional held-out set, loaded from JSON. */
import concepts from '../data/concepts.json';
import curriculum from '../data/curriculum.json';
import errorCodes from '../data/error-codes.json';
import structures from '../data/structures.json';
import m1 from '../data/modules/m1.json';
import m2 from '../data/modules/m2.json';
import m3 from '../data/modules/m3.json';
import heldOut from '../data/held-out/provisional.json';
import { ROOMMATE_SKIN } from './slice.ts';
import type { ContentBundle, HeldOutBundle } from './types.ts';

const modules = [m1, m2, m3] as unknown as Pick<ContentBundle, 'skins' | 'variations' | 'items' | 'feedback' | 'rubrics'>[];

export const CONTENT: ContentBundle = {
  curriculum: curriculum as unknown as ContentBundle['curriculum'],
  concepts: concepts as unknown as ContentBundle['concepts'],
  errorCodes: errorCodes as unknown as ContentBundle['errorCodes'],
  structures: structures as unknown as ContentBundle['structures'],
  skins: [ROOMMATE_SKIN, ...modules.flatMap((m) => m.skins)],
  variations: modules.flatMap((m) => m.variations),
  items: modules.flatMap((m) => m.items),
  feedback: modules.flatMap((m) => m.feedback),
  rubrics: modules.flatMap((m) => m.rubrics),
};

/** PROVISIONAL held-out set: never used in practice; only for validation and future assessment. */
export const HELD_OUT: HeldOutBundle = heldOut as unknown as HeldOutBundle;
