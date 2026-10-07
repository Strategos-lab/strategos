# Regression tests

**Policy: every bug found in the engine gets a test in this folder** — a minimal
reproduction that failed before the fix and passes after it, with a comment
naming the bug, how it was found and the date. Tests here are never deleted;
if behaviour is intentionally changed, update the test and record why.

| File | Bug | Found by |
|---|---|---|
| `iwds-simultaneous-removal.test.ts` | Iterated weak dominance listed only one-at-a-time elimination orders, so `possibleResults` missed results reachable only by removing two actions at once (and `surviving` from the simultaneous procedure was not in the list). | fast-check property "weak elimination reports every order's result", 2026-10-07 |
