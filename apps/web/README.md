# @strategos/web

Static PWA. See the repository root README, `docs/phase0.md` and `docs/slice-roommate.md`.

- `src/content/` — scenario schema/validation; the roommate scenario is composed from `@strategos/content/slice` (data in `packages/content/data`).
- `src/slice/` — flow state machine, engine facts, attempt records.
- `src/pages/SlicePage.tsx` — learner flow (`#/`); `DataPage` (`#/data`); `DevPage` (`#/dev`, developer mode).
- `scripts/slice-shots.mjs <baseURL> <outDir> [seed]` — walk the slice in headless Chromium and screenshot each step.
