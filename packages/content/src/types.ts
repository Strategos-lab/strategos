/**
 * STRATEGOS content schema (Phase 2).
 *
 * Structure × Skin × Variation (plan §3.5, §8.2, §10.1):
 * - Structure: the strategic skeleton (players' action ids, payoff expressions, parameters,
 *   constraints) plus declared structural facts that the validator checks against the engine.
 * - Skin: a narrative mapping (roles, action labels, story, incentives, domain).
 * - Variation: parameter values, learner seat and belief; preserves the structure's facts unless
 *   it declares a deliberate change.
 * Items (explanation, transfer, held-out) point at one structure and a list of skins/variations.
 */

export const DOMAINS = [
  'everyday_life',
  'work_business',
  'social_interaction',
  'markets',
  'sports_games',
  'society_collective',
  'abstract',
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Lesson step order used by terminology gating (plan §2.11, §7.4). */
export const STEPS = [
  'title',
  'encounter',
  'predict',
  'confidence',
  'decide',
  'response',
  'outcome',
  'matrix',
  'explain',
  'feedback',
  'reveal',
  'summary',
] as const;
export type Step = (typeof STEPS)[number];

/** Error taxonomy (plan §7.6.2), plus content-defined codes documented in data/error-codes.json. */
export type ErrorCode = string;

export type Seat = 'A' | 'B';
export type Who = 'you' | 'them';

export interface Concept {
  id: string;
  /** Formal name, shown only at/after reveal. */
  term: string;
  /** Forbidden forms before reveal (lower-case stems, matched at word start). */
  forbidden: string[];
  prerequisites: string[];
  /** Module that teaches it; concepts of later modules are listed so their terms stay blocked. */
  module: number;
  /** Lesson that introduces it; null = taught after Module 3 (term blocked everywhere here). */
  introducedIn: string | null;
  revealStep: Step;
  definition: string;
}

export interface Lesson {
  id: string;
  /** Neutral working title shown before the concept reveal (plan §2.11). */
  workingTitle: string;
  objective: string;
  introduces: string[];
  requires: string[];
  /** Item ids practised in this lesson (discovery/practice/transfer). */
  items: string[];
  /** Standalone slice scenario taught in this lesson (e.g. the roommate reference). */
  scenario?: string;
  reveal?: RevealPage;
}

export interface RevealPage {
  concept: string;
  /** Disciplinary label (Production Rules O2: shown from Phase 3; stored now). */
  discipline: 'GT' | 'DT' | 'BGT' | 'BE' | 'COMPUTATIONAL' | 'OUTSIDE_FORMAL';
  body: string[];
}

export interface Module {
  id: string;
  number: number;
  workingTitle: string;
  formalTitle: string;
  lessons: Lesson[];
}

export interface Curriculum {
  contentVersion: string;
  modules: Module[];
}

export interface StructuralFacts {
  /* The engine's game-family label is deliberately not stored in content data (see structureFamily). */
  /** Strictly dominant action id per player, or null. */
  strictlyDominant: { A: string | null; B: string | null };
  /** Weakly (not strictly) dominant action id per player, or null. */
  weaklyDominantOnly: { A: string | null; B: string | null };
  /** Actions strictly dominated by another pure action, per player. */
  strictlyDominated: { A: string[]; B: string[] };
  /** Whether that player's best response changes with the other's action. */
  bestResponseDependsOnOpponent: { A: boolean; B: boolean };
  /** Unique profile surviving strict IESDS, or null. */
  iesdsSolution: [string, string] | null;
}

export interface Structure {
  id: string;
  version: string;
  module: number;
  discipline: 'GT';
  /** 'sequential_observed': A moves first, B sees A's move (Module 1 identification only). */
  sequence: 'simultaneous' | 'sequential_observed';
  presentation: 'matrix' | 'narrative_only';
  /** Ordinal: only the order matters. Cardinal: sizes are meaningful (plan §2.13). */
  scale: 'ordinal' | 'cardinal';
  actions: { A: string[]; B: string[] };
  /** Key "aId|bId" → [payoff expr for A, payoff expr for B]; expr = integer or parameter name. */
  payoffs: Record<string, [string, string]>;
  params: Record<string, number[]>;
  /** Inequalities over parameters, e.g. "T > R". Combinations violating them are excluded. */
  constraints: string[];
  facts: StructuralFacts;
  heldOut?: boolean;
  notes?: string;
}

export interface SkinRole {
  id: string;
  /** Full name, e.g. "Roommate B". */
  label: string;
  /** Short name used in prompts, e.g. "B". */
  short: string;
}

export interface Skin {
  id: string;
  version: string;
  domain: Domain;
  tone: 'neutral';
  /** Learner-facing working title (neutral). */
  title: string;
  structures: string[];
  /**
   * Story roles from the learner's point of view. `you` is mapped to the structure player given
   * by the variation seat; `other` to the remaining player.
   */
  roles: { you: SkinRole; other: SkinRole };
  /** Seats this skin's story supports (its incentives must cover each). */
  seats: Seat[];
  /** Action id → short label (an id shared by both players has one label). */
  actionLabels: Record<string, string>;
  /** People in the story who make no choice that affects the outcome (Module 1). */
  nonPlayers?: SkinRole[];
  situation: string;
  /**
   * "What matters" per structure (key `structureId`, or `structureId@B` for seat B): incentives in
   * plain words, never the strategic conclusion (Production Rules F).
   */
  incentives: Record<string, string>;
  timing: string;
  information: string;
  /** Accessible name for the matrix (accessibility content). */
  matrixLabel: string;
  outcomes?: Record<string, string>;
  heldOut?: boolean;
}

export interface Variation {
  id: string;
  structure: string;
  params: Record<string, number>;
  seat: Seat;
  /** Learner's belief about the other player's action (rational strings summing to 1). */
  belief?: Record<string, string>;
  /** 'preserve': declared facts must hold. 'change': `facts` replaces them, with a reason. */
  purpose: 'preserve' | 'change';
  facts?: StructuralFacts;
  changeReason?: string;
  heldOut?: boolean;
}

/** Machine-checkable claim attached to every option (evaluated by the engine per instance). */
export type Claim =
  | { t: 'br'; who: Who; against: string; action: string }
  | { t: 'brToBelief'; action: string }
  | { t: 'beliefTie' }
  | { t: 'brMap'; who: Who; map: Record<string, string> }
  | { t: 'strictDom'; who: Who; action: string }
  | { t: 'hasStrictDom'; who: Who }
  | { t: 'noStrictDom'; who: Who }
  | { t: 'weakDomOnly'; who: Who; action: string }
  | { t: 'strictlyDominated'; who: Who; action: string }
  | { t: 'brDepends'; who: Who }
  | { t: 'brIndependent'; who: Who }
  | { t: 'iesds'; profile: [string, string] }
  | { t: 'iesdsUnsolved' }
  | { t: 'dependsOnOther'; who: Who }
  | { t: 'notDependsOnOther'; who: Who }
  | { t: 'playerSet'; actors: string[] }
  | { t: 'actionSet'; who: Who; actions: string[] }
  | { t: 'topOutcome'; who: Who; profile: [string, string] }
  | { t: 'simultaneous' }
  | { t: 'firstMover'; who: Who }
  | { t: 'observes'; who: Who }
  | { t: 'notObserves'; who: Who }
  | { t: 'never' };

export interface Option {
  text: string;
  claim: Claim;
  /** Error code diagnosed when this option is chosen and is not correct. */
  code: ErrorCode;
}

/** Engine-derived value slot. Profiles are always [A action, B action] (story roles). */
export type SlotExpr =
  | { k: 'payoff'; who: Who; profile: [string, string] }
  | { k: 'action'; who: Who; id: string }
  | { k: 'brLabel'; who: Who; against: string }
  | { k: 'domLabel'; who: Who }
  | { k: 'belief'; action: string }
  | { k: 'expected'; action: string }
  | { k: 'beliefBr' }
  /** Engine-chosen wording: `yes` if `who` has a strictly dominant action, else `no` (both templates). */
  | { k: 'ifDom'; who: Who; yes: string; no: string };

export interface FillSlot {
  id: string;
  answer: SlotExpr;
  knownWrong: { value: SlotExpr; code: ErrorCode }[];
}

export type ItemType = 'reason_choice' | 'fill_in' | 'own_words';
export type ItemRole = 'discovery' | 'practice' | 'recognition' | 'transfer' | 'held_out';
export type Exposure = 'undisclosed' | 'disclosed' | 'transfer_hidden';
export type Novelty = 'seen' | 'new_skin' | 'new_domain' | 'new_structure';

export interface Item {
  id: string;
  version: string;
  lesson: string;
  /** Step at which the item is asked (gating). */
  step: Step;
  role: ItemRole;
  concept: string;
  type: ItemType;
  structure: string;
  skins: string[];
  variations: string[];
  exposure: Exposure;
  novelty: Novelty;
  /** Learner seat for every instance (variations must match). */
  seat: Seat;
  prompt: string;
  /** reason_choice: ≥ 2 parallel option sets (plan §7.6.3). */
  optionSets?: Option[][];
  /** fill_in: blanks referenced in the prompt as {slot:id}. */
  slots?: FillSlot[];
  /** own_words: rubric id. */
  rubric?: string;
  /** Named engine slots for feedback templates ({f:name}). */
  facts: Record<string, SlotExpr>;
  heldOutForm?: 'A' | 'B' | 'C';
  /** Practice item this held-out item is a parallel form of (concept + type). */
  parallelOf?: string;
}

export interface FeedbackKey {
  concept: string;
  type: ItemType;
  code: ErrorCode | 'CORRECT';
  /** Restrict this key to these items (item-specific wording); otherwise it applies to every item of the concept and type. */
  items?: string[];
  /** 2–3 phrasings; opening clause must carry evidence (a slot). Order: evidence → conclusion. */
  phrasings: string[];
  /** Optional terminology line, shown last, only when the concept is disclosed. */
  term?: string;
}

export interface RubricCriterion {
  id: string;
  text: string;
  meets: string;
  misses: string;
}

export interface Rubric {
  id: string;
  concept: string;
  prompt: string;
  criteria: RubricCriterion[];
  /** Self-assessment never raises Understanding (plan §3.6). */
  selfAssessmentWeight: 0;
  corroborationRequired: true;
}

export interface ErrorCodeDef {
  code: ErrorCode;
  definition: string;
  source: 'plan' | 'content';
}

export interface ContentBundle {
  curriculum: Curriculum;
  concepts: Concept[];
  structures: Structure[];
  skins: Skin[];
  variations: Variation[];
  items: Item[];
  feedback: FeedbackKey[];
  rubrics: Rubric[];
  errorCodes: ErrorCodeDef[];
}

export interface HeldOutBundle {
  provisional: true;
  structures: Structure[];
  skins: Skin[];
  variations: Variation[];
  items: Item[];
}
