# STRATEGOS — agent operating contract

This file is a short operating contract and navigation layer for Claude Code. It does not duplicate
the product specification; it points to it and states the constraints that bind every task.

## Authority order

1. **`docs/STRATEGOS_V1_PLAN.md`** — authoritative for product scope: what STRATEGOS is and what V1
   contains. (As supplied, this is revision 2, marked "Draft for decision — no implementation
   authorised", amended by a *Final V1 Build Authorisation* that is referenced by
   `docs/STRATEGOS_PRODUCTION_RULES.md` but has not itself been supplied to this repository. Where
   the plan's open decisions, phase sequence or specifics appear to disagree with the current
   repository state, do not silently pick a side — report the conflict. See
   `docs/STRATEGOS_PHASE_STATUS.md` for ones already identified.)
2. **`docs/STRATEGOS_PRODUCTION_RULES.md`** — binding implementation rules: how STRATEGOS must look,
   behave, teach, explain and be built. Read it before every task.
3. **`docs/STRATEGOS_PHASE_STATUS.md`** — current phase, what's completed, what's frozen, what's
   next, what's explicitly not yet authorised.
4. **Package READMEs** (`packages/engine/README.md`, `packages/content/README.md`,
   `apps/web/README.md`) — architecture and API boundaries for the engine, content and web layers.
5. **`packages/content/README.md` + `docs/phase2.md`** — content/authoring rules, validation, lint
   and gating mechanics.
6. Code.

## Binding principles

- **The engine is the sole source of game mechanics.** `@strategos/engine` is the single source of
  truth for legal actions, state, transitions, payoffs, outcomes, best responses, dominance and
  equilibria. Content and UI render engine facts; they never recompute or invent them.
- **No AI/LLM in V1, in any form.** No model calls, no "AI later" slot, no optional switch. This is a
  foundational constraint (V1 Plan, Constraint C1), not a trade-off.
- **No backend, accounts, cloud sync, analytics, or telemetry** unless explicitly authorised.
- **No gamification** (badges, XP, streaks, leaderboards) unless explicitly authorised.
- **Authored content (JSON) cannot independently implement game mechanics.** Every strategic claim in
  content is engine-checked by the content validator; nothing is hard-coded that the engine can
  derive.
- **Tests are never weakened or skipped** to make an implementation pass.
- **The constraints above are not optional trade-offs** against convenience, speed, or a narrow
  request's apparent scope.
- **Changes affecting frozen decisions** (see `docs/STRATEGOS_PHASE_STATUS.md`) require explicit
  approval before implementation.
- **Phase 3 must not begin without explicit approval.**
- **A narrow implementation request does not authorise a broad redesign.** Fix the smallest layer;
  don't refactor working architecture for style.
- **When specifications conflict** (V1 Plan vs Production Rules vs code vs phase docs), stop and
  report the conflict — do not silently resolve it by picking one.
- **Every task reports**: scope, files changed, tests run, and the commit SHA.
