# Learner slice: the shared kitchen (roommate example)

Status: **built**, awaiting confirmation. This is the first learner-facing experience. It adds no
new concepts or modules; it replaces the old home screen (a bare payoff matrix with “Tap a cell to
select an outcome”), which was conceptually wrong: a player never chooses a matrix cell, only their
own action.

## Flow (one card per step, mobile-first)

Home (`#/`): title + **Start** (install card behaviour unchanged). Then:

| # | Step | What the learner sees / does |
|---|------|------------------------------|
| 1 | Encounter | A short story (the situation + “You are Roommate A.”), an at-a-glance block (Players, Choices, Timing, Your task), then five collapsed `<details>` sections (What you each care about, What you control, What B controls, What you know, What the numbers mean; 48 px summaries, keyboard-operable). Story, glance and Continue fit a 390×844 screen without scrolling. **No matrix, no numbers grid.** |
| 2 | Predict | “What do you predict Roommate B will choose?” — Clean / Leave it (actions only). |
| 3 | Confidence | Slider 50–100 % in steps of 5 (no scoring text). |
| 4 | Decide | “What will you choose?” — Clean / Leave it. One tap locks in. Back is available on steps 2–4 only. |
| 5 | Opponent response | “You chose X. Roommate B chose Y.” No Back from here on. |
| 6 | Outcome | Words first (“You get 1. Roommate B gets 1.”), authored story text for that cell, then “Outcome: (1, 1)” with a note that the first number is yours. |
| 7 | Matrix reveal | The table introduced as a model of the situation. Read-only `PayoffMatrix` (rows = A, columns = B, header cells, realised cell highlighted, “your choice” / “B’s choice” marks) and how-to-read notes. |
| 8 | Check your reasoning | Three structured multiple-choice questions, one at a time, each locked once answered: (a) if B cleans, (b) if B leaves it, (c) is one action better whatever B does (Clean / Leave it / No, it depends). Answers and feedback come from the engine. A closing remark notes the pattern without naming any concept. |
| 9 | Summary | Prediction vs B’s actual choice, confidence, whether the choice was the best reply to your own prediction (decision, judged on what you knew), outcome (what happened, partly luck), how B decided. **Try again** starts a fresh attempt with a new seed. |

Focus moves to each step’s heading. Buttons are at least 48 px tall.

## Content (data-driven)

`apps/web/src/content/scenarios/roommate-kitchen.json`, validated by `content/schema.ts`
(`validateScenario`). A scenario must provide all ten context items — what is happening; who the
players are; what each cares about; choices; what the learner controls; what the opponent controls;
what is known and unknown; simultaneous or sequential; what the payoff numbers mean; what the
learner is asked to do — plus a valid engine `NormalGame`, the opponent policy, prompts, story text
for every outcome cell, matrix notes, structured questions and feedback templates. The content test
fails if any field is missing or blank.

Payoffs (A, B): Clean/Clean 3,3 · Clean/Leave 0,5 · Leave/Clean 5,0 · Leave/Leave 1,1, on a 0–5
scale (“how good each outcome is for that person; higher is better; only the order and size within
this situation matter; not money”).

### No answers before the reasoning step

The encounter describes motivations qualitatively (“You both want a clean kitchen. Cleaning takes
effort and nobody enjoys it. Cleaning while the other relaxes and still enjoys the clean kitchen
feels unfair. Roommate B has the same kinds of feelings.”) with no ranked list, so the learner has
to infer the ordering and later read the exact values in the table. A content test bans ranking
words (best, worst, next best, better, prefer…, regardless, either way, whatever …) in all copy
shown before step 8 (encounter items, prompts, outcome stories, matrix notes). The layout of the ten
items (story / glance / details) is fixed in `CONTEXT_FIELDS`, so every scenario gets the same
structure and the validator still requires all ten.

## Engine is the single source of truth

`apps/web/src/slice/engineFacts.ts` is the only place game logic is touched: the outcome cell and
payoffs come from the engine state machine (`initialState` → `step` → `payoffs`), question answers
from `bestResponseTable` / `dominance`, decision consistency from `internalConsistency`, and the
closing remark is shown only if `dominance` finds a dominant action for both players and
`paretoAnalysis` finds that joint outcome improvable. Feedback templates are filled with those engine
values. Components only render.

## Opponent policy (decision)

**Fixed mixed policy:** Roommate B plays **Leave it with probability 7/10, Clean 3/10**, declared in
the content (`opponentPolicy`). Each attempt draws a seed (from the engine’s `deriveSeed` on the
current time and a counter); B’s action is sampled with the engine’s mulberry32 PRNG
(`seedRng(deriveSeed(seed, 1))`, exact rational Bernoulli draw), so any attempt can be replayed
from its seed (`#/?seed=N` replays a given seed; seed 1 → Clean, seed 3 → Leave it).

Why: Leave it is better for B whatever A does, so a mostly-Leave B is sensible, but people do
sometimes clean; the mix makes both outcomes in B’s column appear over attempts, which is what lets
the summary separate a good decision from a lucky or unlucky outcome. It matches what the learner is
told in the encounter: A does not know what B will do; B decides at the same time and cares about the
same kind of things. The exact rule is disclosed only in the summary, after the decision.

The realised draw is never used to grade anything. Decision consistency is judged against the
learner’s own prediction (belief = stated confidence on the predicted action, the rest on the other
action) with `internalConsistency`; the outcome is reported separately as what happened.

## Attempt records

Each completed attempt is written once to the existing learning database (`strategos-v1-learning`,
`events` table) as an event of type `slice.attempt`: scenario id, seed, policy, prediction,
confidence, choice, B’s action, outcome payoffs, consistency, answers with correctness, timestamps,
engine version and content version. No schema change or migration was needed (the table already
stores typed events). Export / import / erase cover these records.

## Visual design (v2)

Presentation only — no change to logic, content text, sequence, persistence or scoring.

- **Principle:** the page is the canvas. Typography, spacing and hairlines carry the structure; the
  outer step card is gone. Cards remain only for the decision controls, the matrix and the install
  card. Three levels: L1 the decision (large question heading), L2 context (story, at-a-glance),
  L3 detail (disclosures, notation, metadata).
- **Tokens** (`apps/web/src/index.css`): surfaces `--bg`/`--surface-1..3`; lines `--line`,
  `--line-strong`; text `--text`, `--text-2`, `--text-3` (all ≥ 4.5:1 on every surface, WCAG AA);
  brass `--accent` / `--accent-soft` / `--accent-line` only for emphasis and selected state; type
  scale `--fs-xs … --fs-display`; spacing `--space-1 … --space-9`; radii `--radius-sm/md/lg`;
  `--shadow-1`; motion `--dur` (180 ms) / `--ease`; `--target` 48 px; brass `--focus-ring`.
- **Fonts:** Inter (variable, latin, 47 KB) and JetBrains Mono (variable, latin, 39 KB) for payoffs,
  percentages and step numbers. Self-hosted in `apps/web/src/assets/fonts/` with their SIL OFL 1.1
  licenses (also served at `licenses/`), precached by the service worker; no external requests
  (asserted in e2e).
- **Screens:** editorial step indicator (`01 / 09  THE SITUATION`); 68 px decision controls with a
  brass left rule + tonal shift when selected; confidence as a large mono percentage over a quiet
  slider; reveal and outcome as typography (big mono scores); the matrix as the one card — gapped
  cells, strong player labels, your payoff bright / B's dimmer, realised cell in brass; reasoning
  feedback shows `✓ Correct` / `Not quite` (from the existing correctness flag) plus the authored
  concluding statement, with the full authored text behind **Why**; summary as a `Your run`
  label/value list and `What to notice` (decision vs outcome, policy reveal).
- **Motion:** ≤ 200 ms fade/slide between steps, matrix and realised-cell reveal; all disabled under
  `prefers-reduced-motion`.

## Developer mode

The old spike (tap-to-select matrix, engine debug output, sample-event storage tools) lives at
`#/dev`, which is not linked from the learner UI. The learner sees a small “Data & app” footer link
(`#/data`) with export / import / erase and install help, without developer wording.

## Tests

- Unit: flow state machine (`slice/__tests__/machine.test.ts`), structured questions vs engine
  (`questions.test.ts`), content validation (`content/__tests__/content.test.ts`), content hygiene,
  full-flow component test with persistence (`pages/__tests__/SlicePage.test.tsx`).
- E2E (Playwright, Chromium Pixel 7 + WebKit iPhone 13): `e2e/slice.spec.ts` walks the slice and
  checks there is no matrix on the encounter, no “Tap a cell” text, no developer labels on the
  learner route, and that `#/dev` still works.
