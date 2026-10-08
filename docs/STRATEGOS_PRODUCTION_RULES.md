# STRATEGOS — Production Rules

Living operational contract. Read before every task.

**Relationship to the V1 Plan.** [`docs/STRATEGOS_V1_PLAN.md`](STRATEGOS_V1_PLAN.md) (as amended by
the *Final V1 Build Authorisation* — that authorisation document itself has not been supplied to this
repository) is the master specification: curriculum, architecture, data model, roadmap. These
Production Rules are the operational standard for how STRATEGOS must **look, behave, teach, explain
and be implemented**. They do not replace the plan.

- Code must not silently override these rules.
- On a conflict (rules ↔ plan ↔ code), do not silently pick one. Identify it, preserve the
  higher-level product decision, and report it before making any speculative change.
- Authorisation overrides of the plan: no AI in any version; GitHub Pages PWA; general-public
  fictional domains only (see B); Module 5 = Social Dilemmas with contrast games; minimal two-stage sequential
  model; phases 0–9 one at a time, each confirmed.

---

## A. Foundational product rules

1. STRATEGOS is a strategic-thinking training system, not a generic course.
2. Learning loop: Encounter → Predict → Decide → Observe → Explain → Modify → Replay → Transfer →
   Retrieve → Master.
3. Game theory is distinct from decision theory, behavioural economics, negotiation and psychology.
   Label which one is speaking.
4. Do not collapse everything into the Prisoner's Dilemma.
5. Recognising the structure of a situation matters as much as solving it.
6. Prediction, decision quality and outcome quality are separate things.
7. A bad outcome is not a bad decision; a good outcome is not a good decision.
8. Decision quality is judged only on the information available at decision time.
9. An equilibrium is never casually presented as a prediction, a recommendation, or necessarily
   socially best.
10. Every strategic claim is supported by the engine or by explicitly authored content.

## B. Non-negotiable technical rules

- **No AI/LLM in any version.** No LLM API, AI SDK, cloud AI, AI grading, AI-generated scenarios or
  feedback, and no hidden "AI later" architecture.
- No server, backend, accounts, cloud database, analytics or telemetry.
- A static, installable, offline-first PWA. No functionality depends on the network.
- Data stays on the device. The IndexedDB event log is the source of persisted learning.
  Export/import is the core recovery path.
- Dependencies only when justified and on the allow-list. No UI library for convenience.
- **The engine is the single source of truth** for legal actions, transitions, outcomes, payoffs,
  best responses, dominance, equilibria, Pareto, and probability/mechanics. Components render
  engine facts and never recreate logic.
- All learner-facing prose is authored content (scenario JSON / templates filled with engine
  values). Components must not invent prose dynamically.
- PWA manifest `id` `/strategos/` (and scope/start_url) never changes.
- Nothing else is published under the Strategos-lab org.
<!-- lint:banned-terms-definition:start -->
- No policing, law-enforcement or profession content. General-public fictional domains only.
<!-- lint:banned-terms-definition:end -->
- `Math.random` is forbidden. Use the engine's seeded PRNG.

## C. Visual design standard (preserve)

- Character: strategic laboratory, a serious thinking instrument. Calm, analytical, editorial,
  restrained, precise. **Not** Duolingo, a gamified course, a SaaS dashboard, a quiz app, a
  children's app, or generic Material.
- Page as canvas. Avoid outer cards. Build hierarchy with spacing, typography and hairlines.
- Cards only for major objects (the matrix, important interactive objects).
- Dark, restrained surfaces. Brass is semantic, not decorative: selected state, strategic emphasis,
  role emphasis, correct state, focus, important transitions. No other decorative accents.
- Inter is the primary face. JetBrains Mono is used selectively for numeric/technical text. Numbers
  are precise and scannable.
- No excessive shadows, gradients, illustrations or noise. No visual redesign unless requested.
- **Rule:** never solve a UX issue with more cards. First ask: *can hierarchy, spacing, typography or
  copy solve this?*

Tokens (`apps/web/src/index.css`, `:root`):

| Group | Tokens |
|---|---|
| Surfaces | `--bg #0d1016`, `--surface-1 #141922`, `--surface-2 #1a202b`, `--surface-3 #212836` |
| Lines | `--line rgba(235,233,228,.09)`, `--line-strong rgba(235,233,228,.18)` |
| Text | `--text #ebe9e4`, `--text-2 #b8b4ac`, `--text-3 #948f86` (all ≥ 4.5:1, WCAG AA) |
| Accent | `--accent #c9a978`, `--accent-soft`, `--accent-line`; `--danger #d08a80` |
| Type | `--font-sans` Inter Variable, `--font-mono` JetBrains Mono Variable; `--fs-xs .75rem` … `--fs-display 3.5rem`; `--lh-tight 1.2`, `--lh-body 1.6`, `--tracking-label .14em`, `--measure 36em` |
| Space | `--space-1 .25rem` … `--space-9 3.5rem` |
| Shape/motion | `--radius-sm/md/lg 6/10/14px`, `--shadow-1`, `--target 48px`, `--dur 180ms`, `--ease`, `--focus-ring` (brass) |

Fonts are self-hosted (OFL, `apps/web/src/assets/fonts/`) and precached. There are no external
requests.

## D. Mobile-first interaction

- Target 360×740 and 390×844; also works on desktop.
- Large touch targets (≥ 48 px). One primary action and one cognitive task per screen.
- Avoid dense multi-question screens, nested containers, and unnecessary scrolling in simple
  decisions.
- Focus moves on every step change. Fully keyboard-usable, with meaningful screen-reader semantics.
- Respect `prefers-reduced-motion`. Never convey state by colour alone.
- Flow: Encounter → Prediction → Confidence → Decision → Reveal → Outcome → The table → Reasoning →
  Summary. Each step is a distinct cognitive state. Do not collapse or rearrange steps casually.

## E. Content and copy

- Short, concrete, neutral, precise, observational, intellectually honest.
- Prefer "Neither of you cleaned. The kitchen stays messy." Avoid "Nobody did the right thing",
  "That was a bad choice", "Fair/Unfair result", "Good players would…", and trait labels
  ("aggressive person", "risk-taker").
- Don't tell the learner what an outcome means when they can infer it.
- One fact, one primary home (story / at-a-glance / disclosure / decision note / summary). Repeat a
  fact only when the repetition serves a different cognitive purpose.
- Plain language before formal terms ("higher payoff", "better response given…", "better whatever
  the other player does"). After introducing a formal term, use it consistently and don't redefine
  it repeatedly.
- Plain-language conclusions ("better either way", "better whatever they do") are gated like the
  formal term: before the reveal, and in transfer or held-out pre-answer text, the story must give
  reasons and payoffs, not the conclusion. Answer options and questions are exempt (the learner
  judges them). Ordinary payoff comparisons are fine.
- Evidence-first feedback: "Leave it gives you 5; Clean gives you 3." then "So Leave it is your best
  response." No "Correct! Great job!", no motivational filler.

## F. Information hierarchy

**Expose the incentives; do not expose the strategic conclusion.** Before a prediction, the learner
must have enough information to form a reasonable model of the other player's incentives and
possible behaviour. However, do not explicitly reveal the payoff ranking, dominant strategy, best
response, equilibrium, or recommended action unless that is the purpose of the current step.
Roommate example: it is appropriate to say both want a clean kitchen and cleaning takes effort. Do
**not** say that getting a clean kitchen without doing the work is preferred to sharing the work —
that reveals the dominant-strategy structure before the learner reasons it through. ("Cleaning alone
means doing all the work" is fine; anything implying free-riding beats sharing is not.)

- Information that is strategically necessary for prediction must never be hidden as optional
  detail.
- Disclosures are only for clarification, technical detail and non-essential context — never for
  facts needed to reason about the opponent.
- Before "What will B choose?" the learner can see the players, objectives/preferences, actions,
  timing, information structure and control.
- Sequential validator scope: the content validator's sequential check (`sequentialIssues`) applies only
  to the V1 Module 1 identification structures marked `sequential_observed`. For those specific
  structures it checks that the authored order and observation are consistent with the engine. It is
  not a general rule: backward induction does not in general coincide with normal-form Nash
  equilibrium, and nothing in content may imply that it does. `sequential_unobserved` structures
  (a later mover who cannot see the earlier choice) are strategically simultaneous and are taught as
  such: order alone gives no advantage without observation.

## G. Learning loop

- Prefer experience → prediction → commitment → reveal → consequence → abstraction → reasoning →
  terminology over explanation → definition → multiple choice → answer.
- When training prediction or decision, don't reveal the matrix before commitment.
- Don't introduce terminology before the learner can notice the pattern, unless the lesson
  requires terminology first.

## H. Outcome and decision quality

- Always distinguish: (1) the belief at decision time, (2) the choice, (3) the opponent's actual
  action, (4) the resulting outcome, (5) what the structure says.
- Decision check is an evidence-based evaluation of the learner's decision relative to the
  information and belief they stated at the time. Decision quality must be evaluated separately
  from outcome quality. The learner must never be judged simply because the eventual outcome was
  good or bad.
- Never use the realised outcome to judge the decision unless the lesson defines that reference
  point.
- Outcome display order: human/observable consequence → payoff → formal representation.

## I. Opponent behaviour

- Don't claim knowledge of an opponent's internal process unless it is modelled.
- Distinguish strategic incentives, behavioural policy, and exercise-generated behaviour.
- Describe a seeded/fixed policy as "B's behaviour in this exercise", not "How B decided".
- Seeds and implementation terms (seed, draw, engine) never appear in learner UI. They may appear
  in persisted attempts and `#/dev`.

## J. Game-theory teaching

- **Best response:** the action giving the highest payoff conditional on the other player's action
  (or a stated belief).
- **Dominant strategy:** a strictly higher payoff against every opponent action. Weak dominance is
  taught separately as a flagged edge case (V1 Plan §2.13, Module 3); iterated weak elimination is
  order-dependent.
- **Nash equilibrium:** a profile where no player gains by deviating alone.
- Never imply that equilibrium = forecast, recommendation, or socially best.
- Never argue "no pure equilibrium, therefore no equilibrium". V1 acknowledges mixed equilibria in
  2×2 games where relevant.
- Repeated games: continuation probability and finite horizon matter. Tit-for-Tat is a behavioural
  strategy / tournament result, not an equilibrium theorem.
- Social dilemmas: the PD is not the universal template. Teach through contrasts (Stag Hunt,
  Chicken, Coordination, Battle of the Sexes, Matching Pennies, Harmony, Deadlock).

## K. Roommate slice standard

- Matrix (A, B): Clean/Clean 3,3 · Clean/Leave 0,5 · Leave/Clean 5,0 · Leave/Leave 1,1. Leave it is
  strictly dominant for both. **Do not alter.**
- The slice can also teach that predicting the other player and choosing your own best action are
  not always the same problem: because Leave it is dominant, the best action does not depend on B.
  Keep this available for later.
- Don't label it a PD prematurely. Don't introduce Nash here unless the curriculum calls for it.
  Don't moralise.
- Formal phrasing: "If both choose the individually higher-payoff action, they reach (1, 1), even
  though (3, 3) would make both better off." Avoid "selfish", "reason badly", "behave badly".

## L. Reasoning feedback

- First occurrence of a concept: evidence + name the concept + brief definition.
- Later occurrences: evidence + use the concept, without repeating the definition.
- Example: Q1 "Leave it gives you 5; Clean gives you 3." / "Leave it is your best response." / Why:
  "A best response is the action that gives you the highest payoff given the other player's
  choice." Q2 "Leave it gives you 1; Clean gives you 0." / "So Leave it is again your best
  response." Q3 "Leave it is better in both comparisons." / "That makes Leave it a dominant
  strategy." + one dominance definition.
- Deterministic and authored. Wrong answers keep the same order: evidence before conclusion.

## M. Summary

- Distinguish prediction, confidence, actual opponent behaviour, learner decision, decision check,
  outcome, and structural insight.
- No redundant prose and no wording that implies hindsight.
- Use the label "Decision check" (see H for its definition) and the heading "B's behaviour in this
  exercise".

## N. No feature creep

No badges, XP, streaks, leaderboards, progress gamification, social features, notifications, AI,
accounts, cloud sync, analytics, unnecessary dashboards, decorative animation, illustrations, or
chat interfaces. Nothing gets built just because it's easy. Every feature must support strategic
learning.

## O. Testing standard

- Preserve tests for: the deterministic engine, engine/content consistency, scenario validation,
  accessibility, mobile layout, offline, PWA, persistence, export/import, no network leakage, and
  content linting.
- Copy tests cover: concept leakage before reveal, outcome-bias language, trait/personality
  language, unsupported claims, contradictory terminology, and excess length where a lint exists.
- Strategic content: never hard-code what the engine can derive. Authored numbers never disagree
  with the engine. Distractors are never accidentally correct.
- Never skip or weaken tests.

## O2. Planned work (not yet implemented)

Recorded for later phases; do not build ad hoc:

- **Phase 2 (implemented; see `docs/phase2.md`):** dependency allow-list enforced in CI
  (`config/dependency-allowlist.json`, `scripts/check-dependencies.mjs`) (B); content-lint concept
  gating and content validation in `packages/content` (`src/gating.ts`, `src/lint.ts`,
  `src/validate.ts`) (V1 Plan §2.11, §10.4).
- **Phase 3:** discipline label (GT / DT / behavioural) shown on reveal (V1 Plan §2.5); expected
  payoffs of each action under the declared belief shown after a single outcome (V1 Plan §2.13).

## P. Implementation discipline

1. Read the existing code and content first.
2. Classify the problem: hierarchy, copy, interaction, pedagogy, styling, or engine.
3. Fix the smallest layer. Default order: **copy → hierarchy → spacing → component behaviour → CSS**.
4. Don't redesign unrelated screens. Don't change tokens without a demonstrated reason.
5. Don't refactor working architecture for style. Add no new abstraction unless it solves a
   repeated problem.
6. Add or update tests, run the full suite, and report what changed and what was intentionally left.

## Q. Design freeze

The current visual language is a stable design system. Change it only incrementally and with
evidence; broad redesigns happen only when explicitly requested. Do **not** replace the typography
or colour system, abandon page-as-canvas, go card-heavy, add a UI kit, add decoration, or add
containers to make sections "feel designed".
