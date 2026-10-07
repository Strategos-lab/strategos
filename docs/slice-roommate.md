# Learner slice: the shared kitchen (roommate example)

Governed by [`STRATEGOS_PRODUCTION_RULES.md`](STRATEGOS_PRODUCTION_RULES.md).

Status: **built**, awaiting confirmation. This is the first learner-facing experience. It adds no
new concepts or modules; it replaces the old home screen (a bare payoff matrix with “Tap a cell to
select an outcome”), which was conceptually wrong: a player never chooses a matrix cell, only their
own action.

## Flow (one step at a time, mobile-first)

Home (`#/`): title + **Start** (install card behaviour unchanged). Then:

| # | Step | What the learner sees / does |
|---|------|------------------------------|
| 1 | Encounter | Short story + “You are Roommate A.”, at-a-glance (Players, What matters, Choices, Timing, Your task), four collapsed `<details>` (What you each care about, Control, What you know, What the numbers mean). **No matrix.** |
| 2 | Predict | “What will B choose?” — Clean / Leave it. |
| 3 | Confidence | “How sure are you?” with compact `B → …` recap; slider 50–100 % in steps of 5. |
| 4 | Decide | “What will you choose?” Note: B chooses at the same time and won’t see your choice. Back on steps 2–4 only. |
| 5 | Opponent response | “You chose X. Roommate B chose Y.” No Back from here on. |
| 6 | Outcome | Observable story first, then “Your payoff 1 / B’s payoff 1”, then quiet notation “(1, 1)”. |
| 7 | Matrix reveal | “Here is the whole game as a table.” Read-only matrix plus three how-to-read notes. |
| 8 | Check your reasoning | Questions revealed one at a time (focus moves to each new question). (a) If B chooses Clean… (b) If B chooses Leave it… (c) Looking at both comparisons, what pattern do you see? Options: Clean / Leave it is always better / It depends on what B chooses. Feedback is evidence-first (payoff comparison headline), then Why with best-response / dominant-strategy definitions on first use. Closing insight notes the mutual-harm pattern without naming a named dilemma. |
| 9 | Summary | Compact Your run (prediction · confidence, actual, decision, “Decision check” — was the choice the best response to your own stated prediction; outcome “N for you · M for B”). What to notice: the decision is checked against your own prediction, not what B did; “B’s behaviour in this exercise”; outcome also depended on B; B’s fixed 70/30 behaviour (after reveal only). **No seed in the learner UI.** **Try again** starts a fresh attempt. |

Focus moves to each step’s heading. Buttons are at least 48 px tall.

## Content (data-driven)

`packages/content/data/roommate/roommate-kitchen.json` (skin + slice data; structure `m3.s.roommate` in
`packages/content/data/structures.json`), composed by `@strategos/content/slice` into the scenario the app
loads (deep-equal to the pre-Phase-2 scenario, contentVersion 1.2.0) and validated by `content/schema.ts`. A scenario must provide all ten context items, a valid engine `NormalGame`, the
opponent policy, prompts, story text for every outcome cell, matrix notes, structured questions and
feedback templates.

Payoffs (A, B): Clean/Clean 3,3 · Clean/Leave 0,5 · Leave/Clean 5,0 · Leave/Leave 1,1, on a 0–5
scale. Leave it is strictly dominant for both; Leave/Leave is the unique pure mutual best-response
profile; Clean/Clean Pareto-dominates Leave/Leave. The slice never names that structure.

### No answers before the reasoning step

Encounter motivations stay qualitative (no ranked list). A content test bans ranking words in copy
shown before step 8. Outcome stories are observational only (no fair/decent/enjoyed-it-for-free).

## Engine is the single source of truth

`apps/web/src/slice/engineFacts.ts` is the only place game logic is touched. Decision quality uses
the learner’s declared prediction (via `internalConsistency`), never hindsight on B’s draw.

## Opponent policy

**Fixed mixed:** Leave it 7/10, Clean 3/10. Disclosed only in the summary after the attempt, as an
authored exercise rule separate from the payoff structure — never as what theory predicts. Seed and
implementation terms stay out of the learner UI (seed remains in the persisted attempt and `#/dev`).

## Attempt records

Each completed attempt is written once to `strategos-v1-learning` as `slice.attempt` (includes seed
for replay). Export / import / erase cover these records.

## Visual design (v2)

Presentation tokens and self-hosted Inter + JetBrains Mono are unchanged by the content pass. See
the prior visual-design section in git history for token detail. Feedback chrome: status indicator +
evidence-first headline + optional Why.

## Developer mode

Old spike at `#/dev`, not linked from the learner UI. Footer “Data & app” → `#/data`.

## Tests

Unit: machine, questions vs engine, content validation + ranking/outcome bans, hygiene, SlicePage
flow. E2E: full walk, encounter fit, policy/seed hidden until summary, Q3 options + dominant-strategy
intro, observational outcome stories, fonts/offline.
