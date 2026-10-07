# Phase 2 — Content system and Modules 1–3

Status: content data, validation and CI gates only. No new lesson UI (Phase 3).

## Architecture (`packages/content`)

Content is **Structure × Skin × Variation**:

- **Structure** — strategic skeleton: sequence (simultaneous / sequential), presentation, scale,
  action ids per seat, payoff expressions per cell (`"a|b"` → `[exprA, exprB]`), optional parameters
  with constraints, and declared `facts` (dominance, dominated actions, best-response dependence,
  IESDS result). The validator rebuilds the game with `@strategos/engine` for every parameter
  combination and fails on any disagreement.
- **Skin** — everyday story: roles, action labels, non-players, incentive text per seat, timing,
  information, matrix label, outcome text for every cell. Seven everyday domains.
- **Variation** — parameter choice, seat, belief, and whether it preserves or changes the answer.

Items reference a structure (or a skin pool), a step, a role (exposure / novelty / transfer) and
option sets. Options carry **claims** (e.g. `br`, `strictDom`, `iesds`, `dependsOnOther`); the
correct option is decided by evaluating claims against the engine for each generated instance.
Text uses tokens (`{act:id}`, `{pay:who:a:b}`, `{br:who:against}`, `{story:…}`) rendered from the
instance, so authored copy holds no digits. Instances are generated with the engine's seeded PRNG
(`deriveSeed`/`seedRng`); seeds are never shown.

Feedback keys map `(concept, type, code)` to 2–3 phrasings; the first clause must carry an
engine-evidence slot. `diagnose` maps a choice to error codes; self-assessment weight is 0 and
own-words answers never change understanding without corroboration.

The roommate slice is the skin `roommate-kitchen` on structure `m3.s.roommate`.
`composeSliceScenario()` produces the scenario the app loads; a test proves it deep-equals the
pre-Phase-2 scenario (payoffs, the 7/10 Leave it · 3/10 Clean policy and the consistency logic are
unchanged).

## Validation and lint (`validateContent`, run in CI)

Unique ids and valid references; prerequisites acyclic; engine-checked facts; complete skins;
exactly one engine-true option per set in every instance; distractor lengths within ±30% of the
answer; known-wrong options never true; every wrong-option code and CORRECT has feedback; copy lint
(length caps, filler, trait language, moralising, colour-only cues, US spelling, digits outside
slots, verdict-first feedback); transfer items use non-practice skins with text similarity < 0.5.

## Concept gating

Each concept has terms and a reveal step. A term may appear only in a later lesson, or in its own
lesson at or after the reveal step. Skin text is gated at the encounter step; matrix labels at the
matrix step; outcomes at the outcome step. M1–M3 introduce no equilibrium concepts.

## Held-out set (provisional)

`data/held-out/provisional.json`: separate structures and skins, 6 items per module, forms A/B/C.
Checks: ids disjoint from practice; practice never references held-out; payoff signatures (and
transposes) unique; text similarity to practice below the cap; each item parallels a practice item
of the same concept and type. Not bundled into the app.

## Dependency allow-list

`config/dependency-allowlist.json` lists every permitted prod and dev dependency with a reason.
`scripts/check-dependencies.mjs` fails on any unlisted or prod-misplaced package; it runs first in
`pnpm test` and as a CI step.

## Editing content

Edit the JSON in `packages/content/data` and run `pnpm test:content`. Declared facts must match the
engine; the failure message prints the engine's values.
