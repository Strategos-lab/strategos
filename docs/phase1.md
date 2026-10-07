# Phase 1 — Engine, mathematical model, tests

Status: **complete** (awaiting confirmation before Phase 2). Engine version `1.0.0`, schema version `1`.

## What was built

- `packages/engine` (`@strategos/engine`): ESM TypeScript package, consumed by `apps/web` through a
  `workspace:*` dependency. API and policies are documented in `packages/engine/README.md`.
  - Model: discriminated union `normal` | `sequential2` | `repeated` with `schemaVersion`, rational
    payoff strings, `payoffScale`, reserved hidden-information fields.
  - Validation + JSON state machine with seeded RNG (mulberry32, explicit state).
  - Best responses (pure and mixed beliefs), pure-strategy dominance, IESDS, iterated weak dominance
    with order-dependence detection.
  - Complete Nash-equilibrium set (pure, isolated mixed, continua; degenerate games) for ≤6×6, exact.
  - Pareto analysis + social-dilemma flag, family classifier with reasons.
  - Decision quality vs declared prior, outcome quality (hindsight), internal consistency,
    counterfactuals.
  - Sequential: backward induction with tie-break policies, comparison with the simultaneous game.
  - Repeated: AllC, AllD, TFT, Grim, TF2T, WSLS, Random(p) with discipline labels; reproducible
    simulation; exact expected payoffs; Grim threshold (T−R)/(T−P); sustainability; finite-horizon
    unravelling.
  - `analyse(game)` facade returning JSON `AnalysisFacts`; `ENGINE_VERSION`.
- Web: debug-only toggle on the home page showing engine best replies for the demo matrix
  (integration check; no concept names). No other UI changes.
- CI: builds the engine, typechecks, runs engine tests with coverage thresholds and the size budget
  **before** the web build; any failure blocks deploy.

## Tests (284 engine tests, all passing; plus 22 web unit tests)

| Category | Tests |
| --- | --- |
| Unit (`test/unit`, 15 files) | 138 |
| Golden fixtures (`test/golden`, 15 hand-verified JSON games) | 117 |
| Property-based (`test/property`, fast-check, 1000 runs each) | 28 |
| Regression (`test/regression`) | 1 |

Property list: affine/positive-scaling and opponent-constant invariance; monotone (ordinal)
invariance of pure facts; action-permutation and player-swap equivariance; existence (≥1 equilibrium
always); pure NE = brute force; exact no-profitable-deviation for every reported mixed, extreme and
continuum point; 2×2 grid soundness/completeness; support enumeration = solver on nondegenerate games
(odd count); strictly dominated actions never in support; pure NE survive IESDS; IESDS order
independence; IWDS result ∈ possible results; PD ⇒ unique Pareto-dominated equilibrium; Grim threshold
agrees with exact Markov values; simulation reproducibility and RNG stream alignment; exact-tie
decision quality.

## Coverage (v8)

Lines 99.48 %, statements 99.18 %, functions 99.68 %, branches 97.88 % (thresholds 95/95/95/90).

## Size

Whole engine API minified + gzipped: ~14.3 KB (budget 40 KB).

## Known limits

- Exhaustive mixed-equilibrium enumeration only up to 6 actions per player (larger: pure only,
  flagged incomplete).
- Dominance by mixed strategies not implemented (documented TODO).
- Sequential games: pure SPE only. Repeated games: perfect monitoring, 2 players.
- Pareto judged against pure outcomes.
- Bug found during Phase 1: iterated weak dominance explored only one-at-a-time removals; fixed,
  with a regression test.

## Remaining (Phase 2+)

Content system and modules, real lesson UI, hidden information (reserved fields), mixed-strategy
dominance.
