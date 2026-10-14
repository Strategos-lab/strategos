# STRATEGOS — Phase status

Durable current-state tracker. Historical phase documents (`docs/phase0.md`, `docs/phase1.md`,
`docs/phase2-plan.md`, `docs/phase2.md`, `docs/slice-roommate.md`) remain build logs of what was done
and when; this file is the one place that states where the project stands *now*. Update it at each
phase boundary rather than inferring current state from commit messages or chat history.

## Current phase

Phase 2 (content system and Modules 1–3) is complete and signed off, per the phase sequence in
`docs/STRATEGOS_V1_PLAN.md` §13. Phase 3 ("Core play UI") is in progress: a generic, item-list-driven
lesson player plays 15 of Module 1–3's 16 lessons end to end (`reason_choice`, `fill_in` and
`own_words` item types); the 16th, `m3.l1`, plays its standalone roommate scenario via the existing,
unmodified `SlicePage`/`machine.ts`/`engineFacts.ts` flow — every lesson in the curriculum is now
reachable from the lesson menu, and `m3.l1` now plays as one continuous lesson: its roommate
scenario, then its 3 generic items, then its reveal. Not yet built: matrix/model-builder UI as a
*generic* item type; predict-with-confidence and decide-as-a-move as generic item types;
observe/DQ items; PWA shell items beyond what already exists; and the deploy/e2e pipeline.

## Current status

**Phase 2 is formally signed off.** The final Phase 2 audit (read-only, covering all eight final
editorial findings, content/educational integrity, frozen-decision verification, repository
hygiene, and full engineering validation) returned a verdict of **PASS**, with the explicit
statement "Phase 2 is ready for sign-off." All eight final editorial findings are resolved.
Executable validation is green (engine, content, web, typecheck, dependency allow-list, build); the
previously documented e2e sandbox browser limitation remains, is non-blocking, and is unrelated to
application code (CI installs browsers fresh). **Phase 3 is now authorised to begin.**

## Completed

- Phase 0 — decisions, GitHub Pages deploy, PWA shell, IndexedDB spike, design-language prototype
  (`docs/phase0.md`).
- Phase 1 — deterministic game-theory engine `@strategos/engine` (`docs/phase1.md`).
- Phase 2 — content system `@strategos/content`, Modules 1–3 content, provisional held-out set
  (`docs/phase2.md`), plus:
  - Phase 2 corrective pass (7 Oct 2026).
  - Phase 2 content top-up — Pass B (content expansion) and Pass B corrections (7 Oct 2026).
  - Storage import-reliability correction (atomic, validated learning-data import/replace).
  - Repository-native source-of-truth anchoring (`CLAUDE.md`, `docs/STRATEGOS_V1_PLAN.md`, this
    file).
  - Final Phase 2 correction pass — all eight findings from the final editorial review resolved.
  - Repository-hygiene scan-boundary corrections for the two controlled specification/status
    documents.
  - **Final Phase 2 audit: PASS. Phase 2 formally signed off.**
- Phase 3 (in progress) — generic lesson player (`apps/web/src/lesson/*`, `pages/LessonPage.tsx`,
  `pages/ModulesPage.tsx`), driven by `@strategos/content`'s Item/Instance model via the new
  `@strategos/content/play` entry point (held-out-firewall-preserving, see
  `packages/content/src/play.ts`):
  - Increment 1 — `m1.l1` playable end to end (`reason_choice` items only).
  - Increment 2 — `fill_in` and `own_words` (self-assessed) item type support added; a lesson menu
    added; every Module 1–3 lesson except `m3.l1` (depends on the still-dormant roommate slice) is
    now playable.
  - Increment 3 — `m3.l1` unblocked in the lesson menu: `LessonPage` plays its roommate scenario
    via the existing, unmodified `SlicePage`/`machine.ts`/`engineFacts.ts`/`slice.ts` flow
    (explicitly frozen, Production Rules §K) rather than redesigning those mechanics generically.
    Deliberately scenario-only in this increment: the scenario and the lesson's 3 generic
    items/reveal were two separate, uncorrelated attempts.
  - Increment 4 — `m3.l1` sequenced into one continuous lesson: `SlicePage` gained an optional
    `onComplete` prop (additive; unused by the standalone roommate route, which keeps "Try again"
    only) shown as a "Continue" action on its summary screen; `LessonPage` plays the scenario
    first, then falls through to the same generic item flow every other lesson uses, ending at the
    lesson's `reveal` screen. The scenario's `slice.attempt` and the lesson's `lesson.attempt`
    remain two independent events (not correlated) — unchanged from increment 3's design, not
    revisited here since nothing read them together yet.
  - Internationally neutral scenario content — see "Pending authorised changes" below.

## Final validated checkpoint

`0cb10e8`

## Frozen Phase 2 decisions

Confirmed present in the repository as of this audit, each traceable to a specific source:

- Roommate game mechanics (payoffs, Leave it dominant) — `docs/STRATEGOS_PRODUCTION_RULES.md` §K:
  "Do not alter."
- Deterministic engine architecture (exact rational arithmetic, no AI) — V1 Plan Constraints C1–C2;
  Production Rules §B.
- Held-out assessment architecture (separate structures/skins, never bundled into the app) — V1 Plan
  §3.4, §10.6; `docs/phase2.md`.
- Structural-isomorphism protection (`heldOutIsomorphisms`) and answer-position/action anti-shortcut
  validation (`heldOutAnswerShortcuts`) — `packages/content/src/validate.ts`; `docs/phase2.md` Pass B
  corrections.
- Phase 2 curriculum structure (`curriculum.json`, modules → lessons → items).
- No AI/backend/accounts/analytics/gamification — Production Rules §B, §N; V1 Plan Constraints C1,
  C3; V1 Plan §12.

## Next gate

Phase 3 ("Core play UI, PWA shell and structured explanation" per V1 Plan §13) is in progress (see
"Completed"). Every Module 1–3 lesson is now playable end to end. Remaining, not yet scoped or
started: matrix/tap-to-mark rendering, predict-with-confidence, decide-as-a-move and
observe-with-DQ items as *generic* item types (not needed by any currently-authored content, so
not built speculatively); and the deploy/e2e pipeline. Each is a separate task.

## Pending authorised changes (not yet implemented)

- **Internationally neutral scenario content.** `docs/STRATEGOS_PRODUCTION_RULES.md` records an
  authorisation override: skin names, settings and vocabulary must be internationally neutral, not
  Indian-English-specific, overriding the V1 Plan's §3.8 "Indian English ... Bengali or Hindi" note
  (that planned localisation path is dropped, not deferred). **Modules 1–3's skins
  (`packages/content/data/modules/{m1,m2,m3}.json`, 73 skins total) are rewritten** (common
  international first names; internationally recognisable settings/vocabulary — café/diner,
  lunch-delivery, football, event hall, city repair app, sandwiches/smoothie — replacing
  canteen/dhaba, tiffin, mela, cricket, wedding-hall/power-cut framing, ward office, housing
  society, thali/lassi) and pass the full content validator and hygiene suite. **The held-out set
  (`data/held-out/provisional.json`) is not yet rewritten** and still uses Indian names, vocabulary
  and settings as of this checkpoint — a separate, not-yet-scoped follow-up (lower priority: it is
  not reachable from the app). The British/Indian English *spelling* convention enforced by
  `packages/content/src/lint.ts`'s `US_SPELLING` check is unchanged (out of scope for this override;
  it is a separate decision from scenario content/vocabulary neutrality).

## Explicitly unauthorised future work

- No AI/LLM, backend, accounts, cloud sync, analytics, telemetry, or gamification in any phase, per
  CLAUDE.md and the V1 Plan's Constraints C1, C3 and §12 "Deliberately NOT in V1" table. These remain
  binding regardless of phase.

## Conflicts identified against `docs/STRATEGOS_V1_PLAN.md`

Reported, not resolved, per CLAUDE.md's "stop and report" rule.

1. **Learner-facing UI built ahead of the V1 Plan's phase sequence.** The V1 Plan's §13 phase plan
   scopes the general "Core play UI" to Phase 3 (built *after* the Phase 2 content system), with the
   "vertical slice" (Modules 1–3 playable end to end, generated from the content pipeline) as the
   Phase 4 exit milestone. The repository instead already has a complete, iteratively refined
   learner-facing experience — the roommate/shared-kitchen slice (`docs/slice-roommate.md`) — built
   and shipped through several commits (e.g. "v2 visual design for the learner slice", "content and
   pedagogy pass on the roommate slice") that **predate** the Phase 2 content-system commit
   (`507a185`) in the repository's own git history. `docs/phase2.md` itself states "No new lesson UI
   (Phase 3)", acknowledging the boundary the Plan draws, even though a hand-built single-scenario UI
   already exists outside that boundary. This may have been separately authorised (the "Final V1
   Build Authorisation" referenced by Production Rules, which has not been supplied to this
   repository, could cover it) — but no such authorisation is visible in-repo, so this is reported as
   an open conflict rather than resolved.
2. **Decision 4 (scenario skins) answered more strictly than the Plan's own question.** V1 Plan §14
   Decision 4 asks whether skins may include *fictional, generic* policing/public-order content, given
   the user's occupation. `docs/STRATEGOS_PRODUCTION_RULES.md`'s "Authorisation overrides" line
   instead states "general-public fictional domains only" and explicitly bans policing/law-enforcement
   content outright (§B: "No policing, law-enforcement or profession content."). This reads as a
   resolution reached via the missing Final V1 Build Authorisation that is *stricter* than what the
   Plan itself proposed, not a contradiction of it — flagged for your confirmation that this is the
   intended, deliberate narrowing.
3. **Package architecture deviates from V1 Plan §7.3 in two ways already self-disclosed in-repo** (not
   new findings, but now confirmed against the actual plan text): `packages/content/README.md` and
   `docs/phase2-plan.md` record that (a) content is authored in JSON rather than the Plan's suggested
   YAML, and (b) diagnosis/template-filling logic lives in `packages/content/src/feedback/` rather
   than a separate `feedback` package. Both are logged as deliberate, reported deviations in
   `docs/phase2-plan.md`. No `learning` or `storage` package exists yet (Plan §7.3) — this is not a
   conflict, since mastery/scheduling/calibration are correctly out of scope until Phase 4/7 per the
   Plan's own phase sequence.

## What this file deliberately does not do

It does not restate the V1 Plan (see `docs/STRATEGOS_V1_PLAN.md`), the Production Rules (see
`docs/STRATEGOS_PRODUCTION_RULES.md`), or the phase-by-phase build history (see `docs/phase0.md`
through `docs/phase2.md` and `docs/slice-roommate.md`). Update this file's "Current phase/status/
candidate/frozen decisions" sections at each phase boundary; leave the historical docs as records of
what happened, not what is true now.
