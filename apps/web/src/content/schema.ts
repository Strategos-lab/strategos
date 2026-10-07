/**
 * Scenario content schema (authored, data-driven). Content describes a situation and supplies
 * wording; it never computes outcomes. Every fact about the game (outcome cell, payoffs, best
 * replies, dominance) is derived from `@strategos/engine` at runtime.
 *
 * Convention: the learner is always players[0] (the row player); the opponent is players[1].
 */
import { Rational, validateGame, type NormalGame } from '@strategos/engine';

/**
 * The ten context items every scenario must state before the learner commits to anything.
 * `placement` fixes the encounter layout for every scenario: the situation opens as a short story,
 * four items form an at-a-glance block, the rest sit in collapsed disclosure sections.
 */
export const CONTEXT_FIELDS = [
  { key: 'situation', label: 'What is happening', shortLabel: 'Story', placement: 'story' },
  { key: 'players', label: 'Who is involved', shortLabel: 'Players', placement: 'glance' },
  { key: 'preferences', label: 'What each person cares about', shortLabel: 'What you each care about', placement: 'details' },
  { key: 'choices', label: 'Choices available', shortLabel: 'Choices', placement: 'glance' },
  { key: 'learnerControls', label: 'What you control', shortLabel: 'What you control', placement: 'details' },
  { key: 'opponentControls', label: 'What the other person controls', shortLabel: 'What B controls', placement: 'details' },
  { key: 'knownUnknown', label: 'What you know and don’t know', shortLabel: 'What you know', placement: 'details' },
  { key: 'timing', label: 'Timing', shortLabel: 'Timing', placement: 'glance' },
  { key: 'payoffMeaning', label: 'What the numbers mean', shortLabel: 'What the numbers mean', placement: 'details' },
  { key: 'task', label: 'What you are asked to do', shortLabel: 'Your task', placement: 'glance' },
] as const;

export type ContextPlacement = (typeof CONTEXT_FIELDS)[number]['placement'];
export const contextFieldsAt = (placement: ContextPlacement) => CONTEXT_FIELDS.filter((f) => f.placement === placement);

export type ContextKey = (typeof CONTEXT_FIELDS)[number]['key'];
export type ScenarioContext = Record<ContextKey, string>;

/**
 * Declared, authored opponent policy. `fixed-mixed`: the opponent's action is drawn from fixed
 * probabilities (rational strings, keyed by the opponent's action ids) with the engine's seeded
 * PRNG on stream `rngStream` of the attempt seed. The realised draw is never used to grade a decision.
 */
export interface FixedMixedPolicy {
  kind: 'fixed-mixed';
  probabilities: Record<string, string>;
  rngStream: number;
  /** Plain-language description shown to the learner after the attempt. */
  description: string;
  /** Why this policy was chosen (documentation for authors). */
  rationale: string;
}

export interface BestReplyQuestion {
  id: string;
  kind: 'best-reply';
  /** Opponent action id the question conditions on. */
  opponentAction: string;
  prompt: string;
}

export interface DominantActionQuestion {
  id: string;
  kind: 'dominant-action';
  prompt: string;
  /** Label of the "no single action" option, e.g. "No, it depends". */
  noneLabel: string;
}

export type StructuredQuestion = BestReplyQuestion | DominantActionQuestion;

/**
 * Feedback templates. Placeholders in braces are filled with engine values only:
 *  {opponentAction} {best} {ranked} {lines} {dominant}
 */
export interface FeedbackTemplates {
  /** One comparison item, e.g. "{action} gives you {payoff}". */
  rankedItem: string;
  /** One line per opponent action, e.g. "If Roommate B chooses {opponentAction}: {ranked}." */
  line: string;
  bestReplyCorrect: string;
  bestReplyIncorrect: string;
  /** Used when several actions tie as best. */
  bestReplyTie: string;
  dominantCorrect: string;
  dominantIncorrect: string;
  noneCorrect: string;
  noneIncorrect: string;
}

export interface Scenario {
  id: string;
  contentVersion: string;
  title: string;
  /** e.g. "You are Roommate A." */
  roleStatement: string;
  context: ScenarioContext;
  /** Must agree with the game kind: 'simultaneous' ⇔ kind 'normal'. */
  timingKind: 'simultaneous';
  game: NormalGame;
  opponentPolicy: FixedMixedPolicy;
  prompts: {
    predict: string;
    /** "{prediction}" is replaced by the predicted action label. */
    confidence: string;
    decide: string;
    decideNote: string;
  };
  /** Story text per outcome cell, keyed "<learnerActionId>|<opponentActionId>"; all cells required. */
  outcomes: Record<string, string>;
  matrix: {
    intro: string;
    howToRead: string[];
  };
  questions: StructuredQuestion[];
  feedback: FeedbackTemplates;
  /**
   * Optional closing remark, shown only when the engine finds a dominant action for both players
   * whose joint outcome is Pareto-dominated. Placeholders: {dominant} {mutualYou} {mutualThem}
   * {betterYou} {betterThem}.
   */
  closingNote?: string;
}

export interface ContentIssue {
  path: string;
  message: string;
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Validate a scenario. Never throws; returns path-addressed issues (empty = valid). */
export function validateScenario(raw: unknown): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  if (!raw || typeof raw !== 'object') return [{ path: '', message: 'scenario must be an object' }];
  const s = raw as Partial<Scenario>;

  for (const k of ['id', 'contentVersion', 'title', 'roleStatement'] as const) {
    if (!nonEmpty(s[k])) add(k, 'required non-empty string');
  }

  if (!s.context || typeof s.context !== 'object') {
    add('context', 'required object with all ten context items');
  } else {
    for (const { key } of CONTEXT_FIELDS) {
      if (!nonEmpty((s.context as Partial<ScenarioContext>)[key])) add(`context.${key}`, 'required non-empty string');
    }
    for (const k of Object.keys(s.context)) {
      if (!CONTEXT_FIELDS.some((f) => f.key === k)) add(`context.${k}`, 'unknown context item');
    }
  }

  const v = validateGame(s.game);
  if (!v.ok) {
    for (const i of v.errors) add(`game.${i.path}`, i.message);
    return issues; // the rest depends on a valid game
  }
  const game = s.game as NormalGame;
  if (game.kind !== 'normal') add('game.kind', 'this slice supports simultaneous (normal-form) games only');
  if (s.timingKind !== 'simultaneous' || game.kind !== 'normal') add('timingKind', 'must be "simultaneous" and match the game kind');
  const [learner, opponent] = game.players as [NormalGame['players'][0], NormalGame['players'][0]];
  const oppIds = opponent.actions.map((a) => a.id);
  const ownIds = learner.actions.map((a) => a.id);

  const pol = s.opponentPolicy;
  if (!pol || pol.kind !== 'fixed-mixed') {
    add('opponentPolicy.kind', 'required; supported: "fixed-mixed"');
  } else {
    if (!nonEmpty(pol.description)) add('opponentPolicy.description', 'required non-empty string');
    if (!nonEmpty(pol.rationale)) add('opponentPolicy.rationale', 'required non-empty string');
    if (!Number.isSafeInteger(pol.rngStream) || pol.rngStream < 0) add('opponentPolicy.rngStream', 'non-negative integer');
    const probs = pol.probabilities ?? {};
    for (const k of Object.keys(probs)) if (!oppIds.includes(k)) add(`opponentPolicy.probabilities.${k}`, 'unknown opponent action');
    let total = Rational.ZERO;
    for (const id of oppIds) {
      const p = probs[id];
      if (p === undefined) {
        add(`opponentPolicy.probabilities.${id}`, 'missing');
        continue;
      }
      try {
        const q = Rational.parse(p);
        if (q.lt(0) || q.gt(1)) add(`opponentPolicy.probabilities.${id}`, 'must lie in [0, 1]');
        total = total.add(q);
      } catch {
        add(`opponentPolicy.probabilities.${id}`, 'must be a rational string');
      }
    }
    if (!total.eq(1)) add('opponentPolicy.probabilities', 'must sum to exactly 1');
  }

  const pr = s.prompts;
  for (const k of ['predict', 'confidence', 'decide', 'decideNote'] as const) {
    if (!nonEmpty(pr?.[k])) add(`prompts.${k}`, 'required non-empty string');
  }

  for (const a of ownIds) {
    for (const b of oppIds) {
      if (!nonEmpty(s.outcomes?.[`${a}|${b}`])) add(`outcomes.${a}|${b}`, 'required story text for every outcome cell');
    }
  }

  if (!nonEmpty(s.matrix?.intro)) add('matrix.intro', 'required non-empty string');
  if (!Array.isArray(s.matrix?.howToRead) || s.matrix.howToRead.length === 0 || !s.matrix.howToRead.every(nonEmpty)) {
    add('matrix.howToRead', 'required non-empty list of strings');
  }

  if (!Array.isArray(s.questions) || s.questions.length === 0) {
    add('questions', 'required non-empty list');
  } else {
    const seen = new Set<string>();
    s.questions.forEach((q, i) => {
      if (!nonEmpty(q.id) || seen.has(q.id)) add(`questions.${i}.id`, 'required unique id');
      seen.add(q.id);
      if (!nonEmpty(q.prompt)) add(`questions.${i}.prompt`, 'required non-empty string');
      if (q.kind === 'best-reply') {
        if (!oppIds.includes(q.opponentAction)) add(`questions.${i}.opponentAction`, 'unknown opponent action');
      } else if (q.kind === 'dominant-action') {
        if (!nonEmpty(q.noneLabel)) add(`questions.${i}.noneLabel`, 'required non-empty string');
      } else {
        add(`questions.${i}.kind`, 'unknown question kind');
      }
    });
  }

  const fb = s.feedback;
  for (const k of [
    'rankedItem',
    'line',
    'bestReplyCorrect',
    'bestReplyIncorrect',
    'bestReplyTie',
    'dominantCorrect',
    'dominantIncorrect',
    'noneCorrect',
    'noneIncorrect',
  ] as const) {
    if (!nonEmpty(fb?.[k])) add(`feedback.${k}`, 'required non-empty string');
  }
  if (s.closingNote !== undefined && !nonEmpty(s.closingNote)) add('closingNote', 'must be non-empty when present');

  return issues;
}

export function assertValidScenario(raw: unknown): Scenario {
  const issues = validateScenario(raw);
  if (issues.length) {
    throw new Error(`Invalid scenario: ${issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ')}`);
  }
  return raw as Scenario;
}
