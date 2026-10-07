# @strategos/engine

Deterministic game-theory engine for STRATEGOS. It is the **single source of truth**: the UI and
content layers never compute outcomes, they render facts returned by this package.

- Pure TypeScript ESM, no runtime dependencies, no I/O, no AI of any kind.
- Exact rational arithmetic (bigint fractions) everywhere in solver logic; no floats.
- All randomness is seeded and reproducible (`Math.random` is banned by a test).
- Size: ~14 KB minified + gzipped for the whole API (`pnpm size`; budget 40 KB).

## Model (`schemaVersion: 1`)

`GameDefinition` is a discriminated union on `kind`:

| kind | shape |
| --- | --- |
| `normal` | 2 players, each with ≥1 actions (`{id,label}`); `payoffs[row][col] = [rowPayoff, colPayoff]` as rational strings (`"3"`, `"-1/2"`); `payoffScale: 'ordinal' \| 'cardinal'`; any m×n. |
| `sequential2` | Same matrix; player 0 (leader) moves first, player 1 (follower) observes and replies. `toSimultaneous(game)` builds the simultaneous version. |
| `repeated` | `stage` (a normal game), `horizon: {type:'fixed', rounds} \| {type:'continuation', delta}` with 0<δ<1, `monitoring: 'perfect'`. |

`hiddenInformation?: {playerTypes?, chance?, informationSets?}` is **reserved** so later phases can add
incomplete/imperfect information without a schema break. V1 validation rejects non-empty values.
Unknown fields are rejected. `makeNormalGame(A, B, opts)` is a convenience builder.

## API

- **Validation / state machine:** `validateGame` (never throws; path-addressed issues),
  `assertValidGame`, `initialState(game, {seed, maxRounds})`, `playersToMove`, `legalActions`,
  `step`, `isTerminal`, `payoffs`. States are plain JSON (including the RNG state).
- **Best responses:** `bestResponses` (to a pure action), `bestResponseTable`, `bestResponseToMixed`.
- **Dominance:** `dominance(game, player)` (pure-strategy strict/weak dominance and dominators),
  `iesds` (strict; order-independent), `iteratedWeakDominance` (returns `surviving` from maximal
  simultaneous removal, every `possibleResults` over all removal orders, `orderDependent`, and
  `WEAK_DOMINANCE_WARNING`).
- **Equilibria:** `pureNash`, `solveEquilibria` (full set, below), `checkNash` (exact deviation
  gains), `isNashEquilibrium`, `supportEnumeration` (independent cross-check), `indifference2x2`,
  `isDegenerate`.
- **Welfare / families:** `paretoAnalysis` (efficient outcomes, Pareto-dominated equilibria,
  social-dilemma flag `everyEquilibriumParetoDominated`), `classifyFamily` (Prisoner's Dilemma, Stag
  Hunt, Chicken, Battle of the Sexes, pure coordination, matching pennies, harmony, deadlock, other;
  with human-readable `reasons`, R/S/T/P role values and tie notes).
- **Decisions:** `expectedPayoffs`, `decisionQuality` (judged against the learner's *declared* prior,
  never the realised outcome), `outcomeQuality` (hindsight, kept separate), `internalConsistency`,
  `equilibriumReference`, `counterfactuals`.
- **Sequential:** `backwardInduction` (tie-break policy `all` / `leader-favourable` /
  `leader-unfavourable`; all pure SPE), `compareWithSimultaneous` (first-mover advantage, etc.).
- **Repeated:** automata `ALL_C`, `ALL_D`, `TIT_FOR_TAT`, `GRIM_TRIGGER`, `TIT_FOR_TWO_TATS`,
  `WIN_STAY_LOSE_SHIFT`, `randomStrategy(p)`; `simulateRepeated` (seeded, reproducible; user moves
  can be a list, an automaton or a policy function), `expectedRepeatedPayoffs` (exact, via a Markov
  chain), `grimTriggerThreshold` = (T−R)/(T−P), `isGrimSustainable`, `finiteHorizonUnravelling`.
- **Facade:** `analyse(game)` → `AnalysisFacts` (JSON-serialisable; rationals as strings);
  `analyseExact` keeps `Rational` objects. `ENGINE_VERSION`.

## Exact-arithmetic policy

All payoffs are parsed into `Rational` (normalised bigint numerator/denominator, positive
denominator). Every comparison, best response, indifference condition, equilibrium and threshold is
computed exactly, so ties are real ties (e.g. 1/3 + 1/3 + 1/3 = 1 exactly). Implicit numeric coercion
of a `Rational` throws; `toNumber()` exists for display only. Hygiene tests forbid float literals,
`parseFloat` and `Math.*` in solver code (only `rng.ts` uses `Math.imul`/`Math.floor`, on 32-bit integer seeds).

## Equilibrium-completeness policy

`solveEquilibria` never reports "no equilibrium": every finite game has one (Nash), and the result
carries `existenceGuaranteed: true`.

- For games with ≤ `MAX_EXHAUSTIVE_ACTIONS` (6) actions per player it computes the **complete**
  equilibrium set by exact extreme-equilibrium enumeration (vertex enumeration of the best-response
  polytopes, Avis–Rosenberg–Savani–von Stengel 2010) followed by maximal-biclique grouping. Output:
  isolated pure and mixed equilibria plus **continua** (each a product of convex hulls of extreme
  equilibria, with dimension and payoff range). Degenerate games are handled and flagged
  (`degenerate: true`). `complete: true`, `finite` says whether the set is finite.
- Larger games: pure equilibria only, `complete: false` with an `incompleteReason`. Downstream
  facts that depend on completeness (e.g. the social-dilemma flag) become `null`, not guessed.
- If enumeration ever found nothing it throws an internal error instead of returning an empty set.
- Ordinal games: mixed equilibria are reported (existence) but `mixedProbabilitiesMeaningful: false`,
  because probabilities are not invariant under monotone re-scaling.

## Guarantees and known limits

- Dominance is against **pure** strategies only. TODO: domination by mixed strategies (e.g. an action
  dominated only by a 50/50 mix survives `iesds` here).
- Pareto efficiency is judged against pure outcomes.
- `backwardInduction` returns pure-strategy SPE only; mixed follower tie-breaking is not enumerated.
- `iteratedWeakDominance` order search is exhaustive up to 65 536 states (`orderSearchComplete`).
- Repeated games: 2 players, perfect monitoring; continuation horizons are capped at 10 000 rounds.
- V1 is 2-player complete information; reserved fields block nothing later.

## Discipline labels

Every strategy/automaton carries a `discipline` and a note so the UI cannot conflate concepts:

- `GRIM_TRIGGER`: game theory — (Grim, Grim) is a subgame-perfect equilibrium of the indefinitely
  repeated Prisoner's Dilemma iff δ ≥ (T−R)/(T−P).
- `TIT_FOR_TAT`, `TIT_FOR_TWO_TATS`, `WIN_STAY_LOSE_SHIFT`, `ALL_C`, `ALL_D`, `Random(p)`:
  "behavioural strategy (Axelrod tournaments); not an equilibrium concept".

**Folk theorem.** With a high enough continuation probability, many outcomes (mutual cooperation
*and* mutual defection) are equilibrium outcomes: repetition makes cooperation *possible*, not
predicted. **Finite horizon.** If the stage game has a unique equilibrium, backward induction
unravels cooperation in every round of a known fixed horizon (`finiteHorizonUnravelling`).

## Tests

`pnpm test` (Vitest + fast-check), `pnpm test:coverage` (thresholds: 95 % lines/statements/
functions, 90 % branches; CI fails below them). Layout: `test/unit`, `test/property`,
`test/golden/*.json` (hand-verified fixtures), `test/regression` (every bug gets a test).
`FC_RUNS` overrides the property-test run count (default 1000).
