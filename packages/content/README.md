# @strategos/content

Typed, deterministic, validated learning content for STRATEGOS. TypeScript source (no build step),
consumed by the web app through `@strategos/content/slice` only. Architecture and rules:
[`docs/phase2.md`](../../docs/phase2.md).

- `data/` — JSON content: `concepts.json`, `error-codes.json`, `curriculum.json`, `structures.json`,
  `modules/m1–m3.json`, `roommate/roommate-kitchen.json`, `held-out/provisional.json`.
- `src/` — types, game building from structures (`game.ts`), instance generation (`instance.ts`),
  claim evaluation (`claims.ts`), template rendering (`render.ts`), concept gating (`gating.ts`),
  copy lint (`lint.ts`), validation (`validate.ts`), feedback diagnosis and rubric (`feedback/`).
- `test/` — validation, gating, lint, distractor, held-out and slice-equivalence tests.

Run `pnpm test:content` from the repo root. Every structural fact is re-derived by the engine on each
run; a disagreement fails the suite.
