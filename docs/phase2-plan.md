# Phase 2 implementation plan (content system + Modules 1–3)

Authorities: [V1 Plan rev. 2](STRATEGOS_V1_PLAN.md) (incl. scope amendments) → `STRATEGOS_PRODUCTION_RULES.md` → code.

## Already in place (reuse)

- Engine: dominance (strict/weak), IESDS, best responses (pure and mixed belief), classifier
  (`classifyFamily`), Pareto, `sequential2` games, seeded RNG. **No engine change needed.**
- Roommate slice: scenario JSON + `validateScenario` (web), engine-filled feedback templates,
  ranking-word ban, banned-terms hygiene lint with marker exemption.

## Build

1. **`packages/content` (`@strategos/content`)** — TypeScript source package (no build step;
   consumed from source by the web app). Plan §7.3 names separate `content` and `feedback`
   packages; diagnosis and template filling live in `src/feedback/` of the same package instead,
   to avoid a second package for ~200 lines (deviation, reported).
   - Data (JSON — plan suggests YAML; JSON avoids a parser dependency; deviation, reported):
     concepts, curriculum (modules → lessons), structures, skins, variations, items, feedback
     library, rubrics, held-out set, roommate reference.
   - Types + validator (`validateContent`) + content lint + concept gating + instance generator
     + feedback (diagnosis + template filling).
   - `@strategos/content/slice` entry: composes the roommate slice `Scenario` from structure +
     skin + item. Web imports only this entry (held-out and module content are not bundled).
2. **Roommate migration**: composed scenario must deep-equal the current JSON (fixture test);
   e2e unchanged.
3. **Structure × Skin × Variation**: structures declare engine-checkable facts (family, strict /
   weak dominance per player, dominated actions, IESDS solution, best response depends on
   opponent, sequence). Validator enumerates every parameter combination and checks the facts
   with the engine. Variations declare params, seat and belief, and whether they preserve
   structure.
4. **Concept graph + gating**: concepts with formal terms, prerequisites, introducing lesson and
   reveal step. Lint renders every learner-facing string per (lesson, step) and blocks terms
   before their reveal. Transfer and held-out items are `transfer_hidden` (no tested-concept term
   before the answer). The graph is acyclic; no Nash equilibrium in Modules 1–3.
5. **Content lint**: required fields, IDs and references, length limits, filler, trait and
   moralising language, evidence-first feedback, no literal payoff numbers in templates, policy
   percentages agree with the policy, distractors checked against the engine for every instance
   (exactly one correct per option set, ≥ 2 option sets, one error code per distractor, ±30 %
   length), feedback coverage, domain from the allowed list, Indian English spellings,
   accessibility (matrix label, short action labels, no colour-only references).
6. **Dependency allow-list**: `config/dependency-allowlist.json` + `scripts/check-dependencies.mjs`
   (node only) + `node --test` tests; wired into the root `test` script and CI before deploy.
7. **Modules 1–3 content** per §10.5/§10.6/Phase 2 exit (≥ 3 structures × 4 skins per module),
   explanation items (reason choice, fill-in, own words), feedback keys with 2 phrasings,
   rubrics, reveal pages.
8. **Provisional held-out set** for Modules 1–3 in 3 parallel forms: own structures and skins,
   validator enforces ID / (structure, skin) / text-similarity separation from practice.
9. Banned-terms lint scope extended to `packages/content`.
10. Docs: `docs/phase2.md`, pointers in the rules and README.

## Not in Phase 2

Play UI for new items, tap-to-justify and step-assembly items (they need the Phase 3 cell-tap UI),
mastery and scheduler, Decision Patterns, Lab, worksheet, Modules 4–6 and contrast-family
templates (Nash-dependent), and a dev content browser.
