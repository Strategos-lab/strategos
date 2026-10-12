/**
 * Practice-content entry (`@strategos/content/play`) for a generic lesson player. Imports only the
 * curriculum, concepts, structures and the authored modules directly — never `./data.ts`, so the
 * held-out set (`data/held-out/provisional.json`, only ever imported by `data.ts`) can never be
 * pulled into anything that imports this file. This mirrors how `./slice.ts` (`@strategos/content/slice`)
 * already isolates the roommate scenario from the held-out set for the same reason.
 *
 * `CONTENT` from `./data.ts` additionally stitches `ROOMMATE_SKIN` into `skins` for the slice; this
 * bundle has no roommate skin, since the roommate scenario is served only via `@strategos/content/slice`.
 */
import concepts from '../data/concepts.json';
import curriculum from '../data/curriculum.json';
import errorCodes from '../data/error-codes.json';
import structures from '../data/structures.json';
import m1 from '../data/modules/m1.json';
import m2 from '../data/modules/m2.json';
import m3 from '../data/modules/m3.json';
import type { ContentBundle } from './types.ts';

const modules = [m1, m2, m3] as unknown as Pick<ContentBundle, 'skins' | 'variations' | 'items' | 'feedback' | 'rubrics'>[];

export const PLAY_CONTENT: ContentBundle = {
  curriculum: curriculum as unknown as ContentBundle['curriculum'],
  concepts: concepts as unknown as ContentBundle['concepts'],
  errorCodes: errorCodes as unknown as ContentBundle['errorCodes'],
  structures: structures as unknown as ContentBundle['structures'],
  skins: modules.flatMap((m) => m.skins),
  variations: modules.flatMap((m) => m.variations),
  items: modules.flatMap((m) => m.items),
  feedback: modules.flatMap((m) => m.feedback),
  rubrics: modules.flatMap((m) => m.rubrics),
};

export { makeLookup, generateInstance, type Instance, type Lookup } from './instance.ts';
export { render, slotValue } from './render.ts';
export { diagnose, feedbackFor, keysFor, feedbackKey, type Response, type Diagnosis, type FeedbackMessage } from './feedback/diagnose.ts';
export type { ContentBundle, Item, Lesson, Module, Curriculum, FeedbackKey } from './types.ts';
