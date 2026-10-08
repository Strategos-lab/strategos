# STRATEGOS — Version 1 Planning Document (revision 2)

Specification audit, architecture and phased implementation plan.

Prepared for: Wangden Bhutia · Date: 7 October 2026 · Revision 2 (supersedes revision 1 of the same
date) · **Status: Draft for decision — no implementation authorised.**

This document contains no application code. Interfaces and schemas are illustrative specification,
written so that a coding agent can later implement against them without reinterpreting intent.

> **Repository note (added when this document was copied into the repository, not part of the
> original plan text).** This file is a faithful repository-native copy of the supplied
> `STRATEGOS_V1_Plan_v2.pdf` (revision 2), transcribed page-for-page. It preserves the plan's own
> status line above verbatim: as supplied, the plan is a draft awaiting the decisions in §14, not a
> confirmed final specification. `docs/STRATEGOS_PRODUCTION_RULES.md` states it is "as amended by
> the *Final V1 Build Authorisation*" — that authorisation document has not been supplied to the
> repository and this copy does not attempt to reconstruct it. Where the current repository state
> appears to differ from what this plan specifies, that is reported in
> `docs/STRATEGOS_PHASE_STATUS.md` and in the session record, not resolved here. Nothing in this
> note is part of the original document.

Implementation does not begin until you approve this plan.

## Changes from v1

| Area | Revision 1 | Revision 2 |
|---|---|---|
| AI | Optional AI coach behind a server proxy | **Removed entirely, permanently.** Recorded as a foundational constraint |
| Explanation-back | AI-graded free text against rubrics | Structured, engine-checked explanation items; free text self-assessed against a model answer and checklist, weighted low (7.6, 8.7) |
| Feedback | AI prose grounded in engine facts | Engine-filled templates keyed by concept, item type and error code (7.6) |
| Error identification | AI classification into a taxonomy | Deterministic diagnosis from the chosen distractor, cell, step or number (7.6) |
| Scenario generation | AI-written skins on engine structures | Hand-authored skins × engine-parametrised structures, seeded (10) |
| Name-hiding | AI forbidden-terms filter at runtime | Content-lint rule in CI (2.11, 10.4) |
| Real-world analysis | Optional AI with send-preview and redaction | Device-only guided worksheet; you tag each statement KNOWN / ASSUMED / INFERRED / UNCERTAIN; candidate-model picker with caveats (9.2) |
| Platform | PWA recommended, undecided | **Static PWA on your GitHub Pages; Android and iPhone** (7.9–7.13) |
| Storage | IndexedDB; cloud backend later | IndexedDB on device only; iOS eviction realities; export/import as core; sync explicitly out of scope |
| Risks | AI contradiction, leakage, cost, keys | Removed; added: deterministic feedback is less adaptive; authored content volume; iOS storage; shared GitHub Pages origin; service-worker updates |
| Testing | Coach evaluations | Removed; added: template rendering, taxonomy mapping, distractor validity, content lint, WebKit + Chromium, offline, install/upgrade, base-path routing |
| Phases | 11 phases (0–10); slice after Phase 5 | 10 phases (0–9); **slice after Phase 4** |
| Open questions | 14 | 12; platform, AI and key questions resolved; GitHub repo and public repo and custom domain added |

## Foundational design constraints

These are not up for trade-off during implementation. A coding agent must treat any design that
violates them as wrong.

**C1. No AI or language model in any version.** No model calls, no "AI later" slot, no optional
switch, no on-device model. *Rationale:* every output is **deterministic** (the same input always
gives the same feedback, so learning effects are attributable); **private** (nothing you type leaves
the phone); **free** (no running cost, no account); **offline** (works on a train or in a dead zone);
and **auditable** (every sentence the app can show exists as authored text in the repository and can
be read, reviewed and corrected).

**C2. The engine is the only source of mechanics.** Legal actions, transitions, payoffs, outcomes,
best responses, dominance and equilibria come only from the engine. Feedback text contains numbers
only by reference to engine output.

**C3. Static and serverless.** The app is a set of static files served from GitHub Pages. No backend,
no accounts, no analytics, no third-party scripts, no network requests after the app and its content
are cached.

**C4. Data lives on the device.** Your learning record and real-world worksheets never leave the
device except in a file you explicitly export.

**C5. Everything recorded is versioned.** Every event records the engine, content and schema versions
that produced it.

## Conventions used in this document

- **GT** = formal (non-cooperative) game theory. **DT** = decision theory. **BE** = behavioural
  economics. **BGT** = behavioural game theory.
- A *payoff* is a utility number, not money, unless stated.
- PD payoffs use the standard letters: **T** (temptation), **R** (reward for mutual cooperation),
  **P** (punishment for mutual defection), **S** (sucker's payoff).
- **δ** (delta) is the probability that a repeated game continues for another round (equivalently, a
  discount factor).
- "Must" means required for V1; "should" means strongly recommended; "may" means optional.

## 1. Audit of the specification

### 1.1 Strengths (briefly)

- **Correct division of authority.** A deterministic engine owns actions, state, transitions and
  payoffs. With the no-AI decision this becomes absolute: no component can produce a fluent but
  wrong account of an outcome.
- **Correct learning science.** Prediction before revelation, retrieval practice, spacing,
  interleaving, calibration and transfer are the evidence-backed levers. Content volume is correctly
  de-prioritised.
- **Decision quality versus outcome quality.** Separating "was the choice good given what was
  knowable?" from "did it work out?" is the core habit of strategic thinking and is rarely built into
  training tools.
- **Disciplinary honesty.** Insisting that negotiation, psychology and behavioural economics are not
  mislabelled as game theory is the right instinct and is unusual.
- **Mastery as multi-dimensional,** with a refusal to accept MCQ scores as mastery.
- **Restraint in scope.** Six modules, deeply, is the right call.
- **Epistemic labelling** (KNOWN / ASSUMED / INFERRED / UNCERTAIN) for real-world analysis.

### 1.2 Overall verdict

The specification is a strong *statement of intent* and a weak *statement of requirements*. Its
principles are right; its operational definitions are mostly missing. A coding agent given it today
would have to decide, on its own, what decision quality means, how mastery is scored, what an
opponent does in a one-shot game, how calibration is judged, when a pattern is "sufficiently
evidenced", and how concept names are kept out of discovery content. Each of those is a pedagogical
decision, not an engineering one, and each would be made inconsistently.

There are also four points where the content as specified is either technically inaccurate or
depends on excluded material: Module 1 and Module 5 are not concepts in the sense the others are;
Nash equilibrium without mixed strategies is misleading; repeated interaction needs backward
induction or a continuation probability; and several opponent types and game-changing levers are
behavioural or incomplete-information constructs that V1 does not model.

None of this is fatal. All of it must be settled before code is written, because the data model, the
scenario format and the mastery calculation all depend on the answers. Sections 2–6 set out the
problems; Sections 7–13 set out a design that resolves them.

## 2. Conceptual problems

Each problem is stated, explained and paired with a recommendation.

### 2.1 "Seeing the Game" is modelling, not a solution concept

**Problem.** Best response, dominance and Nash equilibrium are *solution concepts*: given a game,
they tell you something about it. "Seeing the Game" is the step before any of that — abstracting a
messy situation into players, actions, information, sequence and payoffs. It is arguably the most
valuable skill in the whole product and the hardest to assess, because there is rarely one correct
model of a real situation.

**Consequence if ignored.** Module 1 gets assessed like the others ("what is the equilibrium?"),
which tests nothing about modelling. Or it gets assessed by free-text self-report alone, which is
weak evidence.

**Recommendation.**

- Assess Module 1 *structurally*. The scenario author (or template) declares the canonical model: the
  set of players, each player's action set, who knows what when, the order of moves, and the ordinal
  ranking of outcomes for each player. The user builds a model through structured controls (add
  player, add action, mark "moves first / simultaneous / observes"), and the engine compares it
  component to component.
- Allow **declared acceptable alternatives** (for example, "the regulator may be modelled as a player
  or as part of the environment"). Score against the nearest acceptable model, not a single answer.
- Score sub-skills separately: players identified, irrelevant actors excluded, action sets complete,
  information structure correct, sequence correct, preference ordering correct. These become the
  evidence for the Understanding and Application dimensions of the concept "game modelling".
- Make modelling recur in every later module: before a scenario shows its matrix, a fraction of items
  ask the user to construct it. "Seeing the Game" is then a cross-cutting skill, not just a first
  module.
- Distinguish *matrix-given* items (testing solution concepts) from *narrative-only* items (testing
  modelling plus solution). Showing the matrix gives the modelling solution away.

### 2.2 The Prisoner's Dilemma is a game, not a concept

**Problem.** The PD is a specific class of 2×2 games, defined by the payoff ordering T > R > P > S
(with 2R > T + S added when it is repeated, so that alternating exploitation does not beat steady
cooperation). It is not a concept on a par with Nash equilibrium. It *bundles* three concepts: a
strictly dominant strategy (defect), a unique Nash equilibrium (mutual defection), and Pareto
inefficiency of that equilibrium (both would prefer mutual cooperation). The concept the user actually
needs is the gap between **individual and collective rationality**.

**Consequence if ignored.** PD-centrism. The single most common error among people who learn a little
game theory is labelling every conflict, every arms race and every coordination failure a Prisoner's
Dilemma. Many are Stag Hunts (cooperation is an equilibrium, but risky), games of Chicken (each wants
the other to back down), or coordination problems (any agreement is better than none). The diagnosis
changes the remedy: a PD needs enforcement or repetition; a Stag Hunt needs assurance; a coordination
problem needs a signal.

**Recommendation.**

- Rename Module 5 **"Social Dilemmas: when individual rationality fails collectively"**, with the PD
  as anchor and the public-goods / commons framing as an *n*-player illustration only (not modelled in
  V1).
- **Add contrast games** to V1 as scenario families, not modules: Stag Hunt, Chicken (Hawk–Dove),
  Battle of the Sexes, pure coordination, Matching Pennies, Harmony, Deadlock. Recognition of a
  concept is impossible to measure without negatives; you cannot show that the user recognises a PD
  unless they also correctly say "this is not a PD" when it is not.
- Teach the 2×2 *ordinal* taxonomy lightly: most strategically interesting 2×2 games are distinguished
  only by the order of four payoffs. This gives the user a discrimination tool, not a list.

### 2.3 Nash equilibrium without mixed strategies teaches a falsehood

**Problem.** If V1 only finds pure-strategy equilibria, Matching Pennies (and Rock–Paper–Scissors,
many inspection and patrol games) will be reported as having "no equilibrium". That is false. Nash's
theorem guarantees every finite game has at least one equilibrium *in mixed strategies*. The
policing-relevant example is direct: an inspection or patrol game typically has no pure equilibrium;
its equilibrium is randomised.

There are two further conceptual traps:

- **Equilibrium is not prediction and not recommendation.** A Nash equilibrium is a profile from which
  no player can gain by deviating alone — a *stability* or *no-regret* condition. It does not say what
  people will do (that is an empirical question), nor what *you* should do (that depends on what you
  believe the other player will do).
- **Multiple equilibria.** Coordination games, Stag Hunt, Chicken and Battle of the Sexes have more
  than one. Which one obtains is *equilibrium selection*. Some selection ideas are formal (payoff
  dominance, risk dominance in the Harsanyi–Selten sense); others are not. Schelling's focal points
  depend on shared salience and culture, which lie outside the formal model and must be labelled as
  such.

**Recommendation.**

- The engine must compute mixed equilibria for 2×2 games (by the indifference method: each player
  mixes so as to make the *other* player indifferent between their actions) and report them. For
  larger games in V1 it must say "mixed equilibria not computed", never "no equilibrium".
- Module 4 must include at least one Matching Pennies–type scenario and one explicit item stating that
  every finite game has an equilibrium in mixed strategies. Teaching *how* to compute mixed equilibria
  can be deferred; *acknowledging* them cannot.
- Module 4 must include an item where playing one's equilibrium strategy is a poor decision because
  the opponent is visibly not playing equilibrium (see 2.7).
- Focal-point items carry the discipline label "outside formal GT: salience / convention".

### 2.4 Repeated interaction depends on excluded concepts

**Problem.** The specification excludes sequential games and backward induction from V1, but repeated
games are a kind of dynamic game. Three facts matter:

1. In a PD repeated a **known, finite** number of times, backward induction (subgame perfection) gives
   mutual defection in every round. In fact, every Nash equilibrium of the finitely repeated PD
   produces mutual defection in every round on the equilibrium path. Explaining why requires reasoning
   from the last round backwards — a sequential-game idea.
2. In an **indefinitely** repeated PD (each round, the game continues with probability δ), cooperation
   can be sustained. With a grim-trigger strategy (cooperate until the other defects, then defect
   forever), mutual cooperation is an equilibrium if and only if R / (1 − δ) ≥ T + δP / (1 − δ), which
   simplifies to **δ ≥ (T − R) / (T − P)**. This is the formal content of "the shadow of the future".
3. The **folk theorem**: for δ close enough to 1, a very large set of outcomes (any feasible payoff
   vector giving each player more than their minmax payoff) can be sustained as equilibria, including
   mutual defection. Repetition makes cooperation *possible*, not *predicted*.

**Recommendation.**

- Model V1 repetition primarily with continuation probability δ. This is mathematically self-contained,
  needs no general extensive-form machinery, and teaches the right intuition.
- Include the known-final-round case as a clearly flagged, informal item ("reasoning backwards from
  the last round — formal treatment later"), so the user is not misled into thinking repetition always
  helps.
- State the folk theorem's implication plainly in Module 6: repetition creates many equilibria;
  whether cooperation happens is a question of expectations and selection, not of the mathematics
  alone.

### 2.5 Tit-for-Tat and the behavioural opponents are not equilibrium results

**Problem.** Tit-for-Tat's fame comes from Axelrod's computer tournaments (1980s): a computational,
evolutionary and behavioural result about performance against a particular population of strategies.
It is not an equilibrium result. TFT against TFT is a Nash equilibrium of the indefinitely repeated
PD for high enough δ, but it is generally **not subgame-perfect**: after a single deviation, two TFT
players lock into alternating punishment, and a player can often do better by forgiving. (Tit-for-Tat
against itself is subgame-perfect at most at a knife-edge value of δ, and for some payoffs never.)
Grim trigger, by contrast, is subgame-perfect when δ ≥ (T − R)/(T − P).

Similarly, the specification's opponent types belong to different disciplines:

| Opponent type | Correct discipline | Formal status |
|---|---|---|
| Classical rational | GT | Plays an equilibrium strategy (which one must be specified when there are several) |
| Reciprocal (TFT, TF2T) | Repeated GT strategies; reputation of TFT from Axelrod (computational/evolutionary) | Automaton strategy; equilibrium status depends on δ and refinement |
| Aggressive (always defect, hawkish) | Behavioural description of a fixed policy | A policy, not a "type" in the Bayesian sense unless modelled as one |
| Risk-averse | DT (concave utility over lotteries) | Changes payoffs (utilities), not the solution concept |
| Bounded-rational (level-k, cognitive hierarchy, QRE) | BGT | Formal models, but behavioural ones |
| Unknown | GT with incomplete information (Bayesian), if formalised | Requires types and priors — not in V1 |

**Recommendation.** Every opponent policy and every scenario carries a **discipline label** (GT, DT,
BGT, BE, computational/evolutionary) shown on reveal. TFT is introduced as "a strategy that performed
well in tournaments", not "the optimal strategy". In V1, an "unknown" opponent means "the user is told
a declared prior over a few named policies", not a Bayesian game.

### 2.6 Payoffs are utilities, not money; ordinal versus cardinal

**Problem.** Game-theoretic payoffs represent preferences. A game with PD-shaped *money* outcomes is
not a PD in *utility* if players care about fairness or each other. Example (Fehr–Schmidt inequity
aversion): if a player's utility from exploiting a cooperator is T − β(T − S), where β measures guilt
at being ahead, then for large enough β this falls below R, cooperating becomes the best response to
cooperation, and the material PD becomes, in utility terms, a Stag Hunt. Same money, different game,
different advice.

Separately: dominance and pure-strategy Nash equilibrium depend only on the *order* of payoffs
(ordinal). Mixed equilibria, expected-value comparisons and the decision-quality measure in 2.7
require payoffs on a meaningful scale (cardinal, unique up to positive affine transformation).

**Recommendation.**

- Make this the explicit **GT / behavioural boundary lesson** inside Module 5: the same story shown
  first as a money PD, then with a stated preference for fairness, and the engine shows the game
  changing class. This is the cleanest place in the curriculum to teach where GT stops.
- Every scenario declares whether its payoffs are *ordinal* or *cardinal*. Ordinal scenarios never
  generate mixed-equilibrium or expected-value feedback.
- The UI labels the payoff matrix "payoffs (how much each player values each outcome)", not "points"
  or "rupees", unless the scenario is deliberately about the money/utility gap.

### 2.7 Decision quality is undefined without a declared information state

**Problem.** "Judge decisions against the information available at the time" is the right principle,
but in a simulation the information available is whatever the scenario designer decides. If that is
not declared, the engine will either judge against the opponent's hidden true policy (hindsight —
exactly the error the principle is meant to avoid) or against equilibrium play (which is wrong when
the opponent visibly does not play equilibrium).

**Recommendation — definitions to be adopted.**

Each scenario must declare an **information-given-to-user** object: what the user is told about the
game and about the opponent, including a **declared prior**: a probability distribution over the
opponent's actions (one-shot) or over a small set of opponent policies (repeated). Then:

- **Decision quality (DQ)** = expected payoff of the user's chosen action under the declared prior,
  compared with the expected payoff of the best action under the same prior. Report the shortfall
  ("regret under the prior"), normalised to the scenario's payoff range, so 0 = best available,
  1 = worst available.
- **Three reference points**, reported separately: 1. **Equilibrium reference:** what the action would
  be under equilibrium play (and whether the user's action is part of any equilibrium). 2. **Prior
  reference:** the best response to the declared prior (the DQ figure above). 3. **Own-belief
  reference:** the best response to the user's own *stated prediction*. This measures internal
  consistency — did the user best-respond to what they themselves believed? This is often the most
  diagnostic number in the system.
- **Outcome quality** = realised payoff in this play. Shown, but never used for decision-quality
  judgements.
- If the opponent's true policy is hidden ("unknown opponent"), DQ is computed against the declared
  prior, **never** against the hidden truth. The hidden truth is revealed afterwards as a separate
  fact.
- Where payoffs are ordinal only, DQ is reported categorically (best response / not a best response /
  dominated), not numerically.

This also resolves the tension between equilibrium answers and behavioural opponents (Section 4.5).

### 2.8 Calibration needs proper scoring rules and large samples

**Problem.** "Track accuracy and calibration" is under-specified. Accuracy is misleading against a
stochastic opponent: if the opponent cooperates 60% of the time and the user always predicts
"cooperate" at 60% confidence, they will be "wrong" 40% of the time while being perfectly calibrated.
Calibration (do events you call 70% happen about 70% of the time?) needs many observations per
confidence level.

**Recommendation.**

- Score predictions with a **proper scoring rule**: Brier score as the primary (bounded, intuitive),
  log score as secondary (punishes confident errors harder). Proper rules make honest probability
  reports the best strategy for the user.
- Use **discrete confidence levels** for binary predictions: 50, 60, 70, 80, 90, 99%. For three or
  more opponent actions, a distribution control (allocate 100% across actions).
- Calibration is judged per confidence band. A rough rule: at least 30 predictions in a band before
  that band is commented on, and at least 100–150 predictions overall before any statement of
  "overconfidence" or "underconfidence". Show a reliability chart with uncertainty intervals (for
  example, Wilson intervals), so the user sees what the data can support.
- Expect this to take weeks. Say so in the UI ("calibration feedback unlocks after about 100
  predictions; you have 37").
- Predictions about *opponent behaviour drawn from a declared random policy* are partly luck; feedback
  should compare the prediction with the declared distribution as well as with the realised action.

### 2.9 Decision Patterns: the multiple-comparisons problem

**Problem.** If the system looks for many possible patterns in one person's data, some will appear by
chance. With twenty candidate patterns tested at a 5% threshold, about one will be "found" in pure
noise. Any open-ended "pattern finder" will also find them, every time.

**Recommendation.**

- A **fixed, pre-declared catalogue** of candidate patterns in V1 (about five), each with a precise
  definition, a minimum sample size, a statistical rule and a correction for the number of patterns
  tested. Proposed V1 set: 1. *Overconfidence / underconfidence* (calibration gap with an interval
  excluding zero). 2. *Failure to respond to own prediction* (own-belief DQ shortfall rate above a
  threshold). 3. *Defect-first tendency in repeated games* (round-one defection rate against opponents
  where the declared prior favours cooperation). 4. *Ignoring the other player's incentives* (errors in
  identifying the opponent's best response, compared with the user's). 5. *Outcome bias in evaluating
  decisions* (choosing OUTCOME_BIAS-coded options in "was this a good decision?" items where decision
  quality and outcome diverge; detected deterministically from the option chosen).
- Each surfaced pattern shows **Pattern, Evidence (linked attempts), n, statistic, Confidence,
  Possible interpretation**, and a status (candidate / supported / retired).
- **Never** surface patterns outside the catalogue. Pattern descriptions are authored templates filled
  with the statistics; nothing composes new ones.
- Use language about *decisions in this app*, never about the person ("in 14 of 18 repeated games you
  defected in round one", not "you are distrustful").

### 2.10 The ten-step loop is an arc, not a session

**Problem.** ENCOUNTER > PREDICT > DECIDE > OBSERVE > EXPLAIN > MODIFY > REPLAY > TRANSFER >
RETRIEVE > MASTER cannot run in one sitting without exhausting the user, and it should not: RETRIEVE
and TRANSFER work *because* they are separated in time from the original learning. MASTER is not
something the user does; it is a state the system infers.

**Recommendation.**

- **Per-scenario core loop (every scenario):** Encounter → Predict → Decide → Observe (with
  counterfactual) → Explain. About 3–6 minutes.
- **Optional extensions (selected scenarios):** Modify → Replay (in the Laboratory).
- **Concept-level arc (across days):** discovery → formalisation → varied practice → modify/replay →
  delayed retrieval (≥ 1–3 days later) → transfer (new structure or new domain, name hidden) → mastery
  state.
- The UI shows the arc as a per-concept progress view, not a checklist to finish in one go.

### 2.11 Name-hiding conflicts with recognition

**Problem.** "Don't reveal a concept's name before the user has reasoned through it" is sound for
discovery. But recognition items require the name ("which of these is a dominant-strategy
situation?"), and names leak through many channels: scenario titles, module titles, tags, URLs,
feedback text ("this classic dilemma…"), even loading text.

**Recommendation.**

- Each item has an **exposure state** per concept: *undisclosed* (discovery), *disclosed* (formal
  learning and recognition), *transfer-hidden* (name withheld to test spontaneous application).
- Module titles visible before discovery must not leak the concept. A title such as "Module 3: When
  one choice is always better" already gives the answer away. Use neutral working titles ("Module 3:
  Choices and counter-choices") or numbered sessions until the reveal, then show the formal title
  (Section 14).
- Because all text is authored, name-hiding becomes a **content-lint rule in CI**: every concept has a
  forbidden-terms list including synonyms ("dominant", "dominates", "always better whatever they do",
  "Nash", "equilibrium", "stable outcome", "dilemma", "prisoner", "Tit-for-Tat", "tragedy of the
  commons"); the lint fails the build if any skin, title, option, step, feedback template or
  reveal-gated string reachable in an *undisclosed* or *transfer-hidden* state contains one. Matching
  is case-insensitive, on word stems, and also checks rendered templates for every parameter sample.
- Scenario identifiers in URLs and storage are opaque.

### 2.12 "Change the Game" is comparative statics; some levers are not V1 game theory

**Problem.** Changing a payoff and re-solving is comparative statics — squarely GT. Designing rules to
achieve outcomes is mechanism or institutional design, which the specification lists as a later
domain. Two of the listed levers also exceed V1's model:

- **Communication** without commitment is *cheap talk*. In a PD it changes nothing formally (defection
  is still dominant); in coordination games it can help. Modelling it properly needs signalling or
  pre-play communication stages.
- **Reputation**, in the formal sense (Kreps, Milgrom, Roberts and Wilson, 1982), arises from
  incomplete information — a small probability that the opponent is a committed "type" — which V1
  excludes.
- **Information**: changing from simultaneous to "second player observes the first move" turns the
  game into a **sequential game**, which needs at least a minimal extensive-form model and backward
  induction over two stages.

**Recommendation.**

- Call the V1 feature **"Changing incentives"** (or keep "Change the Game" as a name but label it GT:
  comparative statics), and reserve "institutional design" for later.
- V1 levers: **payoff, reward, penalty** (payoff transformations); **repetition** (δ or horizon);
  **information/timing** (simultaneous versus observed sequential, two stages only) — if you agree to
  the minimal sequential model (Section 14, Q9).
- **Defer communication and reputation**, or implement only as explicitly labelled behavioural
  approximations (for example, "assume a non-binding promise raises the opponent's cooperation
  probability from 0.4 to 0.6 — this is an assumption, not a result").

### 2.13 Further problems found in the specification

These were not in the brief but are genuine.

- **What does the opponent do in a one-shot game?** If the opponent always plays equilibrium,
  prediction is trivial once the user knows the concept; if it is random, single outcomes are noisy.
  Each scenario must declare an opponent policy (possibly a distribution) and whether it is consistent
  with the declared prior. The user must not be able to "learn the bot" across instances; vary priors
  across instances.
- **Single plays are noisy.** One realised outcome against a stochastic policy teaches little. After
  the realised outcome, show the expected payoffs of each action under the declared prior and, for
  repeated games, an optional "replay this 1,000 times" simulation summary.
- **Which seat is the user in?** In asymmetric games, the user's role matters. Rotate seats across
  instances so the user learns to reason from both sides — the habit of "ignoring the other player's
  incentives" is best corrected by playing the other side.
- **Weak dominance and weak iterated elimination.** Iterated elimination of *weakly* dominated
  strategies can give different results depending on elimination order; *strict* elimination does not.
  V1 should teach strict dominance as the main concept and treat weak dominance as an explicitly
  flagged edge case.
- **Goodhart's law on mastery scores.** Once the user can see the score, they will optimise it. Show
  bands rather than numbers (Section 8.6) and never reward speed.
- **Framing effects in skins.** Narrative skins carry emotional and moral weight (for example,
  "betray" versus "defect" versus "undercut"). This is useful (it is real-world-like) but is a
  confound in assessment. Assessment skins should be balanced in tone; framing effects can later
  become explicit behavioural-economics content.
- **The user's domain knowledge is a double-edged asset.** Policing-adjacent scenarios will transfer
  better, but the user's real-world priors may override the stated payoffs ("in reality the other side
  would never do that"). The modelling discipline — "within this model, given these payoffs" — has to
  be taught explicitly, and real-world objections should be routed to the real-world workflow, not
  argued within a formal scenario.

## 3. Missing requirements

### 3.1 Platform and users (decided)

- **Platform: decided.** A purely static, installable PWA on your GitHub Pages, working on Android and
  iPhone and on desktop browsers. Design specifics are in Sections 7.9–7.13.
- **Users.** One user, no login. The data model keeps a local user identifier so that a second profile
  or future sync would remain possible, but neither is planned.
- **Devices.** Data does not sync between devices. Moving to a new phone, or using both phone and
  desktop, is done by exporting a file on one and importing it on the other (7.12).

### 3.2 The specification's AI functions need deterministic designs

The specification assigns seven functions to an AI coach: explanations, natural-language feedback,
explanation-back evaluation, narration, strategic interpretation, reasoning-error identification, and
generation of practice scenarios. With AI excluded, each needs a deterministic design of equal
pedagogical seriousness — not a degraded fallback. The replacements are specified in Section 7.6 and
summarised here:

| Specified AI function | Deterministic replacement |
|---|---|
| Explanation-back evaluation | Structured explanation items checked by the engine; free text self-assessed |
| Natural-language feedback | Engine-filled feedback templates keyed by concept × item type × error code |
| Reasoning-error identification | Diagnosis from which distractor, cell, step or number was chosen, mapped to a fixed taxonomy |
| Explanations and strategic interpretation | Authored reveal pages and interpretation notes per template, with engine numbers inserted |
| Narration | Authored skins (story, roles, action labels, per-round narration lines) |
| Scenario generation | Hand-authored skins × parametrised structures, seeded variation, validated in CI |
| Real-world analysis support | Device-only guided worksheet with user-applied epistemic tags and a candidate-model picker |

The cost is real: less adaptivity and more authoring (Sections 5 and 6). The gain is that every word
the app can say is reviewable before you ever see it.

### 3.3 Data sensitivity

You are a serving police officer. The real-world worksheet invites exactly the material that must not
leave your control: operational situations, investigations, informants, public-order planning,
personnel matters, named individuals. With no AI and no server, **nothing leaves the device through
the app** — which removes the largest risk in revision 1. Three residual risks remain: the device
itself (loss, an unlocked phone, shared use), export files (which can be forwarded, backed up to
cloud drives by the phone, or left in a Downloads folder), and your department's rules on what may be
recorded on a personal device at all (for example under the Official Secrets Act 1923 and
departmental IT policy; the Digital Personal Data Protection Act 2023 may also apply to data about
identifiable people).

**Requirements:**

1. **Warning** at first use of the real-world worksheet and a persistent banner: "Stays on this
   device. Do not enter classified, operational, investigative or personal data."
2. **Real-world worksheets are a separate store**, excluded from the default export. Exporting them is
   a separate, explicit action, with an optional passphrase-encrypted export (standard browser
   cryptography; no network).
3. **Placeholders encouraged:** the worksheet prompts for roles ("Agency A", "Group B"), not names, and
   a local pattern check highlights apparent phone numbers, vehicle numbers and personal names for you
   to replace. It assists; it does not guarantee.
4. **Delete means delete:** a worksheet can be permanently removed, and "erase all data" is available
   in settings.
5. **No real data in training content.** Any policing-adjacent skins are fictional and generic.
6. The app makes **no network requests** after caching (verified by tests, 11.7), so there is no
   channel for leakage even by mistake.

### 3.4 Evaluation design for the central hypothesis

The central hypothesis — that repeated interactive exposure improves recognition and reasoning — has
no measurement plan. Without one, the app produces activity, not evidence.

**Requirements:**

- **A held-out assessment bank:** items with structures *and* surface stories never used in practice,
  kept out of the practice pool permanently, versioned, and drawn without replacement.
- **Baseline assessment** before any teaching (about 20–30 minutes, can be split across two sessions).
- **Periodic re-assessment** (for example every 3–4 weeks) using parallel forms (different items of
  matched difficulty).
- **Near versus far transfer**, measured separately: near = known structure in a new story; far = new
  structure (or new domain) requiring the same concept.
- **A staggered design for one person.** Assess all six concepts at baseline, then teach modules in
  sequence. If held-out scores for each concept rise *after* its module begins and not before, that is
  much stronger evidence than a single before/after comparison (a "multiple-baseline" single-case
  design). It does not prove causation — you are also reading, thinking and working on strategy
  elsewhere — but it separates training effects from general drift and from practice-on-the-test.
- **Record time-on-task** so improvements can be related to effort.
- **Honest framing in the UI**: "This is your trajectory, not proof."

### 3.5 Content authoring is the true bottleneck

The engine is weeks of work; good scenarios are months. The specification lists scenario fields but no
authoring format, validator or generation strategy.

**Requirements:**

- A **scenario authoring format** (human-readable, e.g. YAML) with a schema.
- A **validator** that checks schema and *game-theoretic invariants* for every parameter sample
  (Section 10).
- **Parametric templates**: Structure (game skeleton + parameter ranges + invariants) × Skin
  (narrative domain, roles, action labels, forbidden terms) × Variation (parameter draw, seat, prior).
  One structure with five skins and parameter variation yields dozens of genuinely different
  instances.
- **Domain variety in skins**: business, geopolitics, ecology, everyday life, sport, public
  administration, and fictional, generic policing-adjacent contexts (subject to your approval).
  Surface variety is what makes transfer possible; without it the user learns the stories, not the
  structures.

### 3.6 Rubrics, model answers and self-assessment governance

- Each free-text "in your own words" prompt has a **model answer** and a **rubric checklist** of 3–5
  concrete criteria (for example, "states that the other side's best choice does not depend on
  yours"; "compares your payoffs within each column, not across columns"). Each criterion has a
  one-line example of meeting it and of missing it.
- Self-assessment is honest only if it is easy to be honest: the checklist is shown *after* you submit
  your text, your text stays visible beside it, and criteria are phrased as observable features of the
  text ("Did you mention…?"), not quality judgements ("Was it clear?").
- **Self-assessment accuracy is measured.** For each concept, the app compares your self-assessed
  criteria with your performance on the engine-checked items for the same concept. If self-ratings run
  consistently above engine-checked performance, the weight of self-assessment for that concept falls
  further (8.7). This is shown to you as information, not as a reprimand.
- Rubrics and model answers are versioned content, reviewed like any other.

### 3.7 Session design and onboarding

- **Target session length:** 10–15 minutes (configurable), with a natural stopping point after each
  scenario.
- **Daily review queue:** capped (for example 3–6 items) so review never crowds out new learning.
- **Onboarding:** purpose of the app, data stays on the device and must be backed up by export,
  installation guidance (especially on iPhone), how confidence works, then the baseline diagnostic.

### 3.8 Accessibility and language

- Colour is never the only signal in matrices (use shape, underline, labels, pattern).
- Screen-reader labels on every matrix cell and control; matrices navigable as tables.
- Touch targets at least 44 × 44 points; matrices of up to 3×3 must be usable on a 360-pixel-wide
  screen.
- Indian English spelling and number formats; text externalised so Bengali or Hindi can be added
  later.

### 3.9 Versioning and reproducibility

Every recorded event must carry the **scenario template version, skin version, instance parameters and
seed, engine version, content-bundle version, explanation-item and feedback-template versions, rubric
version, and data-schema version**. Without this, your history becomes uninterpretable as soon as a
scenario, template or algorithm is corrected.

### 3.10 Backup, export and import (core feature)

Device storage can be lost: the operating system may evict it (Safari in particular, 7.11), the
browser's data may be cleared, the phone may be replaced. With no server, **export is the only backup
and the only way to move between devices.** V1 must provide:

- one-tap export of the full event log as a single, documented JSON file (with schema version and a
  checksum);
- import with validation, a preview ("412 events, 1 Mar – 7 Oct 2026"), and merge-by-event-id so that
  importing the same file twice changes nothing;
- a gentle in-app reminder (on the Home screen, not a notification) if no export in 14 days, with the
  date of the last export always visible in settings;
- real-world worksheets exported separately, only on explicit request.

### 3.11 Concept prerequisites

The specification lists modules but not dependencies between concepts. V1 needs a small **concept
graph** (for example: game modelling → best response → dominance → Nash equilibrium → social dilemmas
→ repeated interaction; contrast games attached to Nash and social dilemmas) so the scheduler does not
schedule transfer items on concepts whose prerequisites are weak.

## 4. Contradictions and tensions

Each tension is real; each has a proposed resolution that this plan adopts unless you decide
otherwise.

### 4.1 "Don't over-engineer V1" versus a very general game model

**Tension.** The model must eventually support sequential, repeated, incomplete-information and
Bayesian games. Building all of that now delays V1 by months; building only 2×2 matrices now forces a
rewrite later.

**Resolution.** Design the *schema* for generality, implement the *engine* narrowly. The game
definition is a versioned discriminated union with three kinds — `normal`, `repeated`, `extensive`.
V1 implements `normal` (two players, finite actions, up to 3×3 in practice) and `repeated` (stage game
+ horizon + δ + perfect monitoring + automaton strategies). The `extensive` kind is specified (nodes,
chance moves, information sets, types as a chance move at the root — the Harsanyi transformation), but
only a two-stage perfect-information subset is implemented, and only if the information/timing lever
is approved. Unsupported kinds fail validation loudly; they never half-work.

### 4.2 Content variety versus no generator

**Tension.** Transfer needs many structurally and superficially different scenarios; without a
generator, every story is hand-written.

**Resolution.** Separate structure from surface. The engine supplies unlimited *structural* variation
from parametric templates (payoff draws within invariants, seat rotation, opponent priors, horizons).
Hand-authored **skins** supply the surface; any skin compatible with a structure can be attached to it,
so variety multiplies (Structure × Skin × Variation). Skins are short (80–150 words) and written to a
style guide, so a batch of twenty is a few evenings' work, not a book. All of it is data in the
repository, validated and linted in CI (10.4). This also removes revision 1's tension "AI must not
invent outcomes": nothing invents anything.

### 4.3 Name-hiding versus recognition and LEARN

**Tension.** Discovery requires the name hidden; recognition and formal learning require it shown.

**Resolution.** Per-concept exposure states (Section 2.11). The concept arc fixes the order: discovery
(undisclosed) → reveal and formalise (disclosed) → recognition items (disclosed) → transfer items
(name withheld again, because the test is spontaneous application). The content lint enforces the
forbidden-terms list for each state (2.11).

### 4.4 Explanation-back versus no machine grading of free text

**Tension.** Explaining in one's own words is strong evidence of understanding, and free text cannot
be graded deterministically with any reliability. Structured formats can be checked, but options cue
the answer (recognising a good reason is easier than producing one).

**Resolution.**

- **Generative before selective.** Where an item has both, the free-text prompt (or the fill-in) comes
  *before* any options are shown, so the options cannot cue the explanation.
- **Engine-checked structured explanations carry the evidence** for Understanding: tap-to-justify, step
  assembly and numeric fill-ins are partly generative and fully checkable; reason-choice items are
  capped (7.6, 8.7).
- **Free text is self-assessed** against a model answer and checklist, weighted low, and counted only
  when corroborated by an engine-checked item on the same concept. Self-assessment alone can never
  raise Understanding.
- Self-assessment accuracy is tracked and adjusts its own weight (3.6).

### 4.5 Behavioural opponents versus equilibrium-based "correct answers"

**Tension.** Against a Tit-for-Tat opponent in an indefinitely repeated PD, always defecting (a
stage-game equilibrium action) is a poor decision. Against a level-1 opponent in a beauty-contest-type
game, the equilibrium action loses. If the system marks equilibrium play as "correct", it teaches that
equilibrium is a recommendation — the very error in 2.3.

**Resolution.** Adopt the three-reference-point decision-quality definition (2.7). "Correct" means
*best response to the declared prior*; equilibrium is shown as a separate reference ("this is an
equilibrium action; against this opponent it is not your best response"). Items explicitly testing
equilibrium identification ("which profiles are equilibria?") are graded against the engine's
equilibrium set; items testing decisions are graded against the prior. The two are never conflated in
a single label.

### 4.6 "Do not infer personality" versus Decision Patterns

**Tension.** Any statement about a person's recurring choices drifts toward a personality claim.

**Resolution.** Patterns are statements about *decisions in this app*, from a fixed catalogue, with
evidence and n (Section 2.9). Pattern text is authored, templated and linted against a banned-language
list (trait words: "you are", "aggressive person", "distrustful", "risk-taker"). Patterns can be
retired when evidence no longer supports them. No pattern is ever linked to real-world worksheets.

### 4.7 Offline-first static app versus updates and durability

**Tension.** A cached, offline app keeps running old code after a new version is deployed; and
device-only storage can be lost.

**Resolution.** The service worker detects a new version and shows a quiet "Update available —
reload" prompt; it never activates mid-session. Data-schema migrations run on start-up after an
update, with a pre-migration automatic export kept on device. Durability is handled by
persistent-storage requests and by export as a core feature (3.10, 7.11).

### 4.8 "Avoid gamification" versus the need for motivation

**Tension.** A solo learning tool with no external pressure loses its user within weeks. Points,
badges and streaks would work briefly and corrupt the incentives (practice for points, avoid hard
items to protect a streak).

**Resolution.** Intrinsic, informational feedback only: the per-concept mastery map, the calibration
curve filling in, the held-out assessment trajectory, a plain "sessions this month" count without
streak penalties, and an optional, single local reminder at a time you choose. This uses the strongest
motivator for an adult expert learner — visible competence growth — without creating a game about the
app.

### 4.9 Six modules "deeply" versus repeated interaction needing sequential concepts

**Tension.** Module 6 cannot be taught deeply without some dynamic-game reasoning.

**Resolution.** δ-based repetition as the main model; the known-final-round case flagged and taught
informally; the folk-theorem caution stated explicitly (Section 2.4). If you approve the minimal
two-stage sequential model (for the information lever), a single backward-induction scenario can be
added to Module 6 as a bridge, labelled "preview of sequential games".

### 4.10 Prediction-before-reveal versus learning from the matrix

**Tension (additional).** The user is asked to predict the opponent's move. If the matrix is visible
and the opponent is an equilibrium player, prediction reduces to solving the game; if the opponent is
behavioural, prediction depends on information the user may not have.

**Resolution.** Every scenario's information object states what the user knows about the opponent (a
policy description, a past-play history, or a declared prior). Prediction items are always predictable
*in principle* from the given information; the system never asks the user to predict a hidden random
draw without saying it is random.

### 4.11 Transfer requires novelty versus a finite content bank

**Tension (additional).** Transfer items are valid only once; the bank is finite; spaced review "never
repeats identical questions".

**Resolution.** Track novelty per (structure, skin) pair seen. Parametric variation provides new
instances indefinitely for practice and review; *transfer credit* requires a structure or domain not
previously seen, which is finite and therefore budgeted (Section 10.6). Held-out items are never used
in practice.

### 4.12 Fixed feedback versus adaptive coaching

**Tension (new in revision 2).** A human coach or an AI tailors feedback to exactly what you wrote.
Templates respond only to what the item design anticipated; an unanticipated misconception gets
generic feedback.

**Resolution.** Push adaptivity into *item design and sequencing* rather than prose. Distractors and
steps are designed to elicit specific misconceptions, so the diagnosis is precise even though the text
is fixed. The scheduler adapts *what you see next* to the error codes you produce (an
`INCOMPLETE_COMPARISON` error schedules a short targeted item on comparing within columns). Each
feedback key has two or three authored phrasings rotated by seed. Your free-text answers and the "this
feedback didn't help" button are recorded locally; you can review them, or export them for whoever
maintains the content, to find misconceptions the taxonomy misses; new codes and items are added in
content releases.

## 5. Technical risks

Likelihood and impact: H = high, M = medium, L = low.

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| T1 | Floating-point ties cause wrong dominance or equilibrium results (e.g. 0.1 + 0.2 ≠ 0.3 makes a weak tie look strict) | H | H | Exact rational arithmetic (fraction type on big integers) throughout the engine; no floats in equilibrium logic; tie tests in CI |
| T2 | Feedback template states a number or claim inconsistent with the engine (wrong slot, stale text after a template edit) | M | H | Slots may only reference engine facts by name; template rendering tests across all parameter samples; claims ("is dominant") are slot-driven, never hard-coded |
| T3 | Concept names leak into discovery-state content | M | M | Content-lint in CI over skins, titles, options, steps and rendered templates; failing lint blocks deploy |
| T4 | Device storage evicted or cleared, history lost (especially iOS Safari) | M | H | `navigator.storage.persist()`; install-to-home-screen guidance; export as core feature with reminders; pre-migration auto-export |
| T5 | Home-screen and browser copies on iOS hold separate data; user thinks data is lost | M | M | Detect display mode; one-time explanation card; recommend using only the home-screen app; export/import to consolidate |
| T6 | Service-worker update breaks an in-progress session or strands an old version | M | H | Prompt-to-reload update strategy; never auto-activate mid-session; versioned content bundle; upgrade tests |
| T7 | Data-schema migration corrupts the event log | L | H | Append-only log; migrations as pure, tested transforms on fixtures from every prior version; automatic export before migrating |
| T8 | GitHub Pages base path misconfigured; deep links or assets 404; service worker scope wrong | M | M | Vite `base` set to `/<repo>/`; hash routing; service-worker scope test on a Pages-like deploy in CI |
| T9 | Shared origin: every project site under `<user>.github.io` shares one browser origin, so another of your Pages sites could read the app's storage | L | M | Host no untrusted code on other project pages of the same account; namespaced database; a custom domain or a dedicated account gives a separate origin (Section 14) |
| T10 | Changing the URL later (repo rename, custom domain) changes origin or scope and the app appears empty | M | M | Decide URL in Phase 0; if changed, export from old, import to new; documented procedure |
| T11 | Bundle too large or slow on mid-range Android | M | M | Performance budget (7.9) enforced in CI; content split by module and lazy-loaded; no heavy chart or UI libraries |
| T12 | Schema over-generalisation delays V1 | M | M | Narrow engine, general schema (4.1); unsupported kinds rejected by validator |
| T13 | Schema under-generalisation forces rewrite at V2 | M | M | Discriminated union with versions; extensive kind specified now; event log enables re-projection |
| T14 | Event-log replay becomes slow as history grows | L | M | Cached projections with snapshots; full recompute only on algorithm version change |
| T15 | Non-determinism makes bugs irreproducible and counterfactuals inconsistent | M | M | Seeded RNG; seed stored per attempt; counterfactual re-simulation reuses the seed |
| T16 | Mobile layout cannot fit 3×3 matrices with labels | M | M | Phase-0 design spike on a 360 px screen; abbreviation rules; landscape option |
| T17 | Weak iterated elimination gives order-dependent results | M | L | Strict IESDS by default; weak flagged as order-dependent |
| T18 | Mixed-equilibrium computation beyond 2×2 wrongly implied | M | M | Engine output states its scope ("pure: complete; mixed: 2×2 only"); feedback templates must render that scope |
| T19 | Authored content volume becomes the bottleneck and delays modules | H | H | Parametric templates; reusable skins; authoring style guide and checklists; validator and lint give fast feedback; content targets sized per phase (10.6); content work starts in Phase 2, in parallel with UI |
| T20 | Coding agent drifts from the plan (invents pedagogy, adds features, adds an AI dependency "for convenience") | M | H | This document as the contract; constraint C1 checked in review and by a dependency allow-list in CI; phase exit criteria; your review at each phase boundary |

## 6. Educational risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| E1 | PD-centrism: user labels every conflict a PD | H | H | Social Dilemmas framing; contrast games; recognition items with negatives; `PD_OVERLABEL` error code tracked |
| E2 | Equilibrium misread as prediction or recommendation | H | H | Three-reference DQ; items where equilibrium play is a poor decision; distractors coded `NE_AS_PREDICTION`, `NE_AS_RECOMMENDATION` |
| E3 | Learning stories, not structures (no transfer) | H | H | Structure × Skin separation; ≥ 4 skins per structure; transfer credit only for new structure/domain; held-out bank |
| E4 | Outcome bias reinforced by the app ("you lost, so you chose badly") | M | H | DQ and outcome shown separately, DQ first; feedback templates linted for outcome-judging phrasings; `OUTCOME_BIAS` distractors |
| E5 | Mastery inflation from easy, scaffolded or recognisable items | M | H | Evidence tagged by difficulty, scaffolding and novelty; selected-response items capped; delayed-success requirement |
| E6 | Self-assessment inflation (ticking rubric items generously) | H | M | Low weight; corroboration requirement; self-assessment accuracy tracked and used to reduce weight |
| E7 | Options cue the answer (recognising a reason is easier than producing one) | H | M | Generative steps (free text, fill-in, step assembly) before selection; selected-response capped in Understanding |
| E8 | Gaming the distractors (learning which option style is right rather than why) | M | M | Options of matched length and register; randomised order; ≥ 2 parallel option sets per item; distractor validity checks (11.4) |
| E9 | Fixed feedback is adaptive than a coach; unanticipated misconceptions get generic responses | H | M | Diagnostic item design; scheduler adapts to error codes; rotated phrasings; local "didn't help" log reviewed for new codes (4.12) |
| E10 | Feedback feels repetitive over weeks, reducing attention | M | M | 2–3 phrasings per key; concise feedback; numbers always specific to the instance |
| E11 | Mislabelling disciplines | M | M | Discipline label on every scenario, opponent and reveal page; validator requires it |
| E12 | Premature calibration or pattern feedback misleads | H | M | Gating thresholds; intervals shown; "not enough data yet" states |
| E13 | Fatigue and drop-off from long sessions | M | H | 10–15 minute sessions; five-step core loop; review cap; clear stopping points |
| E14 | Name-hiding frustrates an expert learner | M | L | Short discovery items; "I know this — test me" option that must be passed |
| E15 | Real-world priors override model assumptions in formal scenarios | M | M | "Within this model" framing; one-tap note routing to the real-world worksheet |
| E16 | Teaching a falsehood through simplification (no mixed NE, TFT as optimal, repetition guarantees cooperation) | M | H | Content items in 2.3–2.5; every reveal page and feedback template reviewed against a checklist of common misstatements |
| E17 | Assessment contamination (held-out items leak into practice) | M | H | Held-out bank stored separately; validator prevents shared structure+skin pairs; drawn without replacement |
| E18 | n = 1 evaluation over-interpreted | H | M | Multiple-baseline design; "trajectory, not proof" wording; parallel forms |
| E19 | Framing effects in skins bias choices and confound assessment | M | L | Balanced-tone assessment skins; framing becomes explicit BE content later |

## 7. Minimal viable architecture

### 7.1 Principles

1. **The engine is the single source of truth** for legal actions, state, transitions, payoffs,
   outcomes and equilibrium facts. Nothing else computes these.
2. **Pure and deterministic.** Given a game definition, a state, an action and a seed, the engine
   always returns the same result. No UI, network or storage dependencies.
3. **Exact arithmetic.** All payoffs and probabilities in the engine are exact fractions. Floating-point
   is used only for display and statistics in the learning layer.
4. **Event-sourced learning record.** What happened is stored once, as facts; everything you see about
   your progress is calculated from those facts and can be recalculated when an algorithm is improved.
5. **All words are authored data.** Every sentence the app can display — skins, reveal pages, options,
   steps, feedback templates, pattern descriptions — lives in versioned content files, validated and
   linted in CI. No component generates prose.
6. **Static, offline, device-only.** A static site on GitHub Pages; a service worker caches the whole
   app and content; data lives in IndexedDB behind a repository interface.

### 7.2 Stack

- **Language:** TypeScript throughout.
- **App:** React + Vite, static build; PWA via vite-plugin-pwa (Workbox) for the manifest and service
  worker. A small design-token system rather than a heavy UI kit.
- **Routing:** hash-based client routing (7.9).
- **Storage:** IndexedDB via Dexie, behind a repository interface.
- **Validation:** a runtime schema library (for example Zod) for content files, events and imported
  backups.
- **Content:** YAML (authoring) compiled at build time to JSON bundles split per module.
- **Testing:** Vitest (unit), fast-check (property-based), Playwright with Chromium and WebKit on
  mobile viewports, axe-core (accessibility).
- **CI/CD:** GitHub Actions: test → validate and lint content → build → deploy to GitHub Pages.
- **Monorepo tool:** pnpm workspaces.
- **Dependency allow-list** in CI: no network-calling SDKs, analytics or AI libraries can be added
  without failing the build (enforces C1 and C3).

### 7.3 Packages

| Package | Responsibility | Depends on |
|---|---|---|
| `engine` | Game model types, rational arithmetic, seeded RNG, legal moves, transitions, payoffs, best responses, dominance, IESDS, pure NE, 2×2 mixed NE, Pareto efficiency, repeated-game automata and thresholds, counterfactuals, game classification, "analysis facts" | nothing |
| `content` | Scenario templates, skins, concept graph, error taxonomy, explanation items, feedback templates, rubrics and model answers, reveal pages; validator and content lint; instance generator | engine |
| `feedback` | Diagnosis (response → error codes), template selection and slot filling from analysis facts, phrasing rotation | engine, content |
| `learning` | Mastery, scheduling, calibration, Decision Patterns, self-assessment accuracy — pure functions over the event log | engine, content (types) |
| `storage` | Repository interface; IndexedDB implementation; export/import; migrations; persistence requests | event and entity types |
| `app` | React PWA: screens, interaction components, service-worker update handling | all of the above |

### 7.4 Component diagram

```
GitHub repo (public: code + content only, no user data)
    | push to main
    v
GitHub Actions: test -> validate/lint content -> build
    | deploy static files
    v
GitHub Pages  https://<user>.github.io/<repo>/
    | first load over HTTPS; then cached
    v
+--------------------------- phone -----------------------------+
|  service worker (offline cache of app + content bundles)      |
|                                                                 |
|  app (React PWA)                                                |
|   Home | Module arc | Play | Lab | Review | Progress | RW       |
|    |         |             |          |                        |
|    v         v             v          v                        |
|  content ---> engine -----> feedback      learning              |
|  (templates,  (pure, exact,  (diagnosis,   (mastery,             |
|   skins,      seeded)        templates)    schedule,             |
|   items)                    |             calibration,          |
|                              | facts       | text   patterns)    |
|                              v             v                    |
|  storage: IndexedDB (append-only event log + projections)       |
|           RealWorldWorksheet: separate store                    |
|           export/import <-> JSON file on the phone              |
+------------------------------------------------------------------+
      No network after caching. No server. No AI.
```

### 7.5 Event-sourced core

The learning record is an **append-only log** of events. Nothing is updated in place. Examples:

- `AttemptStarted` (scenario instance, seed, exposure state)
- `ModelBuilt` ("Seeing the Game" items: the user's structural model and its comparison result)
- `PredictionMade` (distribution over opponent actions, confidence level)
- `DecisionMade` (action or strategy chosen, time taken, hints used)
- `OutcomeObserved` (realised profile, payoffs, engine-facts hash)
- `CounterfactualViewed`
- `StructuredResponseSubmitted` (item id and version, response, engine check result, error codes)
- `FreeTextSubmitted` (text, prompt id)
- `SelfAssessmentRecorded` (rubric criteria ticked, rubric version)
- `FeedbackShown` (template keys and versions), `FeedbackFlagged` ("didn't help")
- `LabExperimentRun` (base game, change applied, result facts)
- `ReviewCompleted`, `AssessmentItemCompleted`
- `DataExported`, `DataImported`, `MigrationApplied`

Every event carries: event id, timestamp, local user id, app version, engine version, content-bundle
version, data-schema version, scenario template and skin id/version, parameters hash, seed.

**Projections** — mastery, calibration, patterns, self-assessment accuracy, review queue — are derived
by pure functions in `learning`. Consequences: algorithm changes re-score history (with version
recorded); export/import is a copy of the log; bugs in projections never corrupt the raw record; and
any future sync, if ever wanted, would be log replication.

### 7.6 Deterministic explanation, feedback and diagnosis

This replaces every AI function in the specification. It has four parts: the error taxonomy,
structured explanation items, free-text self-assessment, and feedback templates.

#### 7.6.1 Analysis facts

For every attempt the engine produces an **AnalysisFacts** object: the game as presented, each
player's payoffs per cell, best responses, dominance relations, IESDS result, pure NE set, 2×2 mixed
NE where applicable, Pareto-efficient profiles, game family, the user's model, prediction and
decision, realised outcome, decision quality under each reference point (2.7), counterfactual
payoffs, and for repeated games the round history and thresholds (for example δ* = (T − R)/(T − P)).
Every number that feedback can show is a named field here.

#### 7.6.2 Reasoning-error taxonomy (V1, fixed)

| Code | Meaning | Typical trigger |
|---|---|---|
| `MISREAD_PAYOFF_OWNER` | Used the other player's payoff as one's own | Numeric slot equals the opponent's payoff in that cell |
| `INCOMPLETE_COMPARISON` | Compared payoffs for only one opponent action | Tapped one column only when justifying dominance |
| `ACROSS_NOT_WITHIN` | Compared cells across the opponent's actions instead of within | Tapped a diagonal pair |
| `IGNORED_OPPONENT_INCENTIVE` | Predicted an action that is dominated for the opponent | Prediction or step choice |
| `NOT_BR_TO_OWN_PREDICTION` | Decision is not a best response to own stated prediction | Engine check on decision vs prediction |
| `CONFUSED_NE_WITH_OPTIMUM` | Treated the highest-total or Pareto-best outcome as the equilibrium | Distractor choice |
| `NE_AS_PREDICTION` | Treated equilibrium as what will happen | Distractor choice |
| `NE_AS_RECOMMENDATION` | Treated equilibrium as what one should do regardless of the opponent | Distractor or decision vs declared prior |
| `MISSED_MULTIPLE_EQUILIBRIA` | Found one equilibrium where several exist | Cell marking |
| `NO_EQUILIBRIUM_CLAIM` | Claimed no equilibrium exists (ignoring mixed) | Distractor choice |
| `DOMINANCE_FROM_OUTCOME` | Called an action dominant because it led to a good outcome once | Distractor choice |
| `ASSUMED_BINDING_AGREEMENT` | Assumed promises are enforceable when the scenario says they are not | Distractor or step |
| `IGNORED_CONTINUATION` | Ignored the chance of future rounds | Repeated-game step or distractor |
| `FINITE_HORIZON_OVERLOOKED` | Ignored a known final round | Repeated-game item |
| `PD_OVERLABEL` | Classified a non-PD as a PD | Recognition item |
| `OUTCOME_BIAS` | Judged the decision by its realised outcome | Distractor in a "was this a good decision?" item |
| `MODEL_MISSING_PLAYER` / `MODEL_EXTRA_PLAYER` | Omitted a relevant player, or included an actor who makes no choice | Model-builder comparison |
| `MODEL_WRONG_TIMING` / `MODEL_WRONG_INFO` | Wrong order of moves, or wrong account of who observes what | Model-builder comparison |
| `MODEL_WRONG_RANKING` | Misordered a player's preferences over outcomes | Model-builder comparison |

New codes are added only in content releases, with definitions, so historical diagnoses stay
interpretable.

#### 7.6.3 Structured explanation items

| Item type | What the user does | How the engine checks it | Diagnosis |
|---|---|---|---|
| Tap-to-justify | "Show why your choice is better whatever they do": tap the pairs of cells that justify the claim | Set of tapped comparisons equals the required set | One column only → `INCOMPLETE_COMPARISON`; diagonal → `ACROSS_NOT_WITHIN`; opponent's numbers → `MISREAD_PAYOFF_OWNER` |
| Reason choice | Choose the reason that justifies a claim from 4–5 options: one correct, the rest diagnostic distractors | Option id | Each distractor maps to exactly one code |
| Step assembly | Order 3–5 reasoning steps from a pool that includes 1–2 plausible but wrong steps | Required steps present, in a valid order (partial orders allowed) | Wrong step included → its code; missing step → its code; order error → step-specific code |
| Fill-in with slots | "Against [action •], Cooperate gives you [] and Defect gives you [], so…" | Numeric slots equal to engine values (exact); dropdown slots equal to required actions | Slot value matches a known wrong source (opponent's payoff, wrong column, total) → that code |
| In your own words | Short free text (1–3 sentences) | **Not machine-graded** | None; self-assessed (7.6.4) |

**Distractor design rules (enforced in review and partly by validator):** each distractor is plausible
to someone holding the misconception; maps to exactly one error code; matches the correct option in
length (±30%) and register; contains no absolute words that give it away ("always", "never") unless
the correct option has them too; options are shuffled by seed so the same two parallel option sets so
the same wording is not seen twice in a row.

**Order within an item:** generative before selective. Free text or fill-in first; reason choice
after; feedback last.

#### 7.6.4 Free text and self-assessment

After submitting free text, the user sees the **model answer** beside their own text and ticks the
**rubric checklist** (3–5 observable criteria). This is recorded as self-assessment.

**How each response type counts as evidence** (detail in 8.7):

| Evidence | Strength | Rule |
|---|---|---|
| Model builder, tap-to-justify, fill-in, step assembly | Strong (engine-checked, partly generative) | Full weight |
| Reason choice | Moderate (engine-checked, but selective — options cue) | Capped share of Understanding |
| Free-text self-assessment | Weak (unverified) | Low weight; counts only if an engine-checked item on the same concept in the same arc stage was also correct; weight reduced further if self-assessment accuracy is poor |

**Honest weakness.** Self-assessment measures what the user *believes* they wrote, filtered by what
they now recognise in the model answer. It is useful practice — writing the explanation is itself
retrieval and elaboration — but weak evidence. Hence the rule: **Understanding cannot be raised by
self-assessment alone**, and no dimension can reach "Secure" without engine-checked evidence.

#### 7.6.5 Feedback templates

Feedback is selected by the key **(concept, item type, error code or `CORRECT`)** and filled from
AnalysisFacts. Examples (illustrative, authored content):

- `best_response` / `tap_to_justify` / `INCOMPLETE_COMPARISON`:
  "You compared only the case where they choose {oppAction1}. Against {oppAction1}, {myA} gives you
  {u(myA,opp1)} and {myB} gives you {u(myB,opp1)}. Now check the other case: against {oppAction2},
  {myA} gives you {u(myA,opp2)} and {myB} gives you {u(myB,opp2)}."
- `dominance` / `fill_in` / `MISREAD_PAYOFF_OWNER`:
  "{value} is the other side's payoff in that cell. Yours is {u_self(cell)}. In each cell, your
  payoff is the {first|second} number."
- `nash` / `reason_choice` / `CONFUSED_NE_WITH_OPTIMUM`:
  "({a},{b}) gives the highest total ({total}), but if they play {b}, you would gain by switching to
  {deviation}: {u(dev)} instead of {u(a,b)}. An outcome is stable only if neither side gains by
  switching alone."
- `repeated` / `step` / `IGNORED_CONTINUATION`:
  "With a {delta} chance of another round, cooperating against this opponent is worth {vCoop} in
  expectation and defecting {vDefect}. The threshold here is {deltaStar}."

**Template rules:** slots reference only named AnalysisFacts fields; every template renders for every
parameter sample of every compatible template (tested); 2–3 phrasings per key, rotated by seed;
templates have exposure-state variants and are linted for forbidden terms, trait language and
outcome-judging language; reveal pages and per-template interpretation notes follow the same rules.

#### 7.6.6 Diagnosis

Diagnosis is a pure function: (item, response, AnalysisFacts) → list of error codes. It is fully
determined by item design — which distractor, which cell, which step, which wrong number — plus
engine checks (for example, whether the decision best-responds to the stated prediction). Error codes
feed feedback selection, the scheduler, and the Decision Pattern catalogue.

### 7.7 Game model (summary)

A versioned discriminated union:

- **normal** — players, finite action sets, payoff function over action profiles (exact fractions),
  payoff scale (`ordinal` | `cardinal`). V1: two players, typically 2×2 to 3×3.
- **repeated** — a stage game (`normal`), a horizon (`fixed T` | `continuation δ`), monitoring
  (`perfect` in V1), and a strategy space of finite automata: Always Cooperate, Always Defect,
  Tit-for-Tat, Grim Trigger, Tit-for-Two-Tats, Win-Stay-Lose-Shift (Pavlov), Random(p). An automaton
  is a set of states, an action per state, and a transition per observed opponent action.
- **extensive** (schema reserved) — nodes (decision, chance, terminal), information sets (sets of
  nodes a player cannot distinguish), chance probabilities, terminal payoffs. Incomplete information
  enters as a chance move at the root that selects types (the Harsanyi transformation), so Bayesian
  games need no separate kind. V1 implements only two-stage perfect-information trees, if approved.

**Opponent** = a policy (a fixed distribution over actions in one-shot games, or an automaton in
repeated games) + a **discipline label** + a **disclosure level** (fully disclosed, declared prior
over policies, or hidden with declared prior).

### 7.8 Engine functions (V1)

| Function | Notes |
|---|---|
| Legal actions, step/transition, payoff, terminal check | For `normal`, `repeated`, and (if approved) two-stage `extensive` |
| Best responses | To a pure action, and to a probability distribution (needed for DQ) |
| Strict and weak dominance | Per player; returns dominating/dominated pairs |
| IESDS | Strict (order-independent) by default; weak flagged as order-dependent |
| Pure NE enumeration | Complete for finite two-player games |
| Mixed NE for 2×2 | Indifference method; handles degenerate cases (ties) explicitly |
| Pareto efficiency | Of each outcome; flags Pareto-inefficient equilibria |
| Expected payoffs under a distribution | Exact |
| Decision quality | Under equilibrium, declared prior and own-belief references |
| Repeated-game simulation | Automaton vs automaton or user vs automaton; seeded random continuation |
| Cooperation thresholds | Grim trigger δ* = (T − R)/(T − P); TFT conditions reported with their status |
| Counterfactual re-simulation | Same seed, alternative user action or strategy; returns payoffs and opponent responses |
| Game classification (2×2) | Identifies PD, Stag Hunt, Chicken, BoS, coordination, Matching Pennies, Harmony, Deadlock by payoff order; used by validator and by recognition items |
| Comparative statics | Re-solve after a payoff transform, horizon change or timing change; diff of facts |

### 7.9 Hosting on GitHub Pages

- **Purely static build.** The output is HTML, JavaScript, CSS, JSON content bundles, icons and the
  service worker. No server, no backend, no accounts.
- **Project-page base path.** The site lives at `https://<user>.github.io/<repo>/`; Vite's `base` is
  set to `/<repo>/`; the manifest's `start_url` and `scope` and the service worker's scope all use the
  same path.
- **Routing: hash router (recommended).** URLs of the form `…/<repo>/#/play/…`; GitHub Pages has no
  server-side rewrite; a hash router needs none, works identically offline, and avoids the `404.html`
  redirect trick (which serves deep links with a 404 status and interacts awkwardly with the service
  worker). The cosmetic cost — a `#` in URLs — is irrelevant for an installed app.
- **Deployment.** A GitHub Actions workflow on push to `main`: install → unit/property tests →
  content validate and lint → build → end-to-end smoke test → upload Pages artifact → "GitHub Actions".
  A failed step prevents deployment, so a broken build never replaces a working one.
- **HTTPS** is automatic on github.io (and required for service workers).
- **Public repository.** On a free account, Pages requires a public repository. That is acceptable
  here because the repository contains only application code and authored content; **no user data is
  ever in the repository** — your record exists only on your device.
- **Usage limits** (site size around 1 GB, soft bandwidth around 100 GB per month) are irrelevant at
  this scale; the app will be a few megabytes.
- **Custom domain (optional, later).** Possible with a CNAME and automatic HTTPS. Note that a domain
  change is an origin change: data does not follow automatically (export and import).
- **Shared origin caution.** All project pages of one account share the origin `<user>.github.io`, and
  browser storage is per origin. Any other project site you publish on the same account could, in
  principle, read this app's stored data. Keep other Pages sites on that account free of third-party
  code, or use a custom domain or separate account to isolate STRATEGOS (Section 14).

**Performance budget (targets for a mid-range Android phone, e.g. a 2–3-year-old ₹12,000–18,000
device, on 4G):**

| Measure | Target |
|---|---|
| Initial JavaScript (compressed) | ≤ 200 KB for app shell; engine ≤ 40 KB |
| Content bundle per module (compressed) | ≤ 150 KB, lazy-loaded |
| Total cached for full offline use | ≤ 2 MB |
| First load, Largest Contentful Paint | ≤ 2.5 s |
| Repeat load from cache to interactive | ≤ 1 s |
| Interaction response (tap to visual response) | ≤ 100 ms; Interaction to Next Paint ≤ 200 ms |
| Engine analysis of a 3×3 game / lab update | ≤ 50 ms |

Budgets are checked in CI (bundle size) and in a Lighthouse run against the deployed site with a
mobile profile.

### 7.10 PWA and offline behaviour

- **Manifest:** name, short name, icons (192 and 512 px, maskable), theme and background colours,
  `display: standalone`, `start_url` and `scope` under the base path.
- **Service worker** (Workbox via vite-plugin-pwa): precaches the app shell and all module content
  bundles on first load, so the whole app works offline thereafter.
- **Update strategy: prompt, never silent.** On a new deployment the new service worker installs in
  the background and waits. The app shows a quiet "Update available — reload when ready" line on
  Home; it is never shown or applied mid-scenario. On reload, migrations run (below) and the new
  version activates.
- **Versioned content.** Each deployment has a content-bundle version. Events record it. An
  in-progress attempt started under an older content version is completed under that version's
  cached data or, if no longer available, closed cleanly and recorded as abandoned — never mixed.
- **Data-schema migrations:** numbered, pure transforms; before migrating, the app writes an automatic
  local export; migrations are tested against fixtures from every prior schema version.
- **Install guidance.** Android (Chrome): the app offers its own "Install" button using the browser's
  install prompt. iPhone: there is no install prompt; a one-time instructional card shows Share → Add
  to Home Screen, with a picture.

### 7.11 Storage on the device, and iPhone realities

- **IndexedDB via Dexie**, one namespaced database; the real-world worksheet in a separate object
  store.
- **Request persistent storage** (`navigator.storage.persist()`) on first meaningful use; show the
  result in settings ("Storage: persistent / may be cleared by the browser").
- **iOS Safari realities:**
- Safari may delete all script-written storage for a site that has not been used for 7 days of
  browser use (its tracking-prevention policy). Web apps added to the Home Screen are treated
  differently, but retention is still not guaranteed.
- The Safari tab and the Home Screen app may hold **separate storage**: data entered in one may not
  appear in the other. The app detects whether it is running standalone and, if in a Safari tab,
  recommends switching to the installed app and explains the separation.
- Storage quotas exist and differ by browser; the V1 event log (a few MB after a year) is well within
  them.
- **Therefore export/import is core V1** (3.10), with the reminder on Home and the last-export date in
  settings.

### 7.12 Cross-device use

Data does not sync between phones, or between phone and desktop. Export a file on one device and
import it on the other; import merges by event id, so repeated imports are safe. The recommended
pattern is one primary device; a second device is a reader or a backup.

### 7.13 Future sync — explicitly out of scope

Revision 1 described a future cloud backend. With no AI and no server, that is reframed as **optional
future sync, explicitly out of scope** for V1 and not planned. The repository interface and the
append-only, versioned event log keep it possible (sync would be replication of immutable events), so
nothing in V1 forecloses it.

## 8. Data model

Illustrative TypeScript-style interfaces. These are specification, not code to run. Exact rational
numbers are written as `Rational` (numerator/denominator).

### 8.1 Core reference entities

```
type Discipline = "GT" | "DT" | "BGT" | "BE"
                 | "COMPUTATIONAL" | "OUTSIDE_FORMAL";
type Dimension = "understanding" | "recognition"
                | "application" | "transfer";

interface User {
  id: string;
  createdAt: string;
  settings: {
    sessionMinutes: number;  // default 12
    reviewCap: number;       // default 5
    reminderTime?: string;
  };
}

interface Concept {
  id: string;
  displayName: string;      // hidden when undisclosed
  forbiddenTerms: string[]; // incl. synonyms
  discipline: Discipline;
  prerequisites: string[];  // concept ids
  module: number;           // 1..6, or 0 for contrast
}

interface Player { id: string; roleLabel: string; }
interface Action { id: string; label: string; }
```

### 8.2 Game definitions

```
type GameDefinition = NormalGame | RepeatedGame | ExtensiveGame;

interface NormalGame {
  kind: "normal"; schemaVersion: number;
  players: Player[];              // V1: exactly 2
  actions: Record<string, Action[]>; // by player id
  payoffs: PayoffEntry[];         // one per profile
  scale: "ordinal" | "cardinal";
}
interface PayoffEntry {
  profile: Record<string, string>; // player -> action
  payoff: Record<string, Rational>;
}

interface RepeatedGame {
  kind: "repeated"; schemaVersion: number;
  stage: NormalGame;
  horizon: { type: "fixed"; rounds: number }
         | { type: "continuation"; delta: Rational };
  monitoring: "perfect";          // V1
}

interface ExtensiveGame {           // schema reserved
  kind: "extensive"; schemaVersion: number;
  nodes: GameNode[];                // decision|chance|terminal
  infoSets: { id: string; player: string;
              nodeIds: string[] }[];
}

interface Automaton {               // repeated-game strategy
  id: string; name: string;         // "TFT", "GRIM", ...
  initial: string;
  states: Record<string, { action: string;
    next: Record<string, string> }>; // on opp. action
  discipline: Discipline;
}

interface OpponentPolicy {
  id: string; label: string;        // shown after reveal
  kind: "fixed_mix" | "automaton" | "equilibrium";
  mix?: Record<string, Rational>;
  automatonId?: string;
  discipline: Discipline;
}
```

### 8.3 Scenarios

```
interface ScenarioTemplate {
  id: string; version: number;
  concepts: string[];               // concept ids taught/tested
  discipline: Discipline;
  family: string;                   // "PD", "STAG_HUNT", ...
  game: ParametricGame;             // structure + params
  invariants: Invariant[];          // checked by validator
  infoGiven: InfoGivenSpec;         // what the user may know
  opponent: OpponentSpec;           // true policy + prior
  presentation: "matrix" | "narrative_only" | "timeline";
  difficulty: DifficultyFactors;
  counterfactuals: CounterfactualSpec[];
  skins: string[];                  // skin ids
  contrastWith: string[];           // sibling template ids
  role: "discovery" | "practice" | "recognition"
      | "transfer" | "held_out";
  rubricId?: string;
}

interface ScenarioInstance {
  id: string;                       // opaque
  templateId: string; templateVersion: number;
  skinId: string; seed: string;
  params: Record<string, Rational>;
  userSeat: string;                 // player id
  game: GameDefinition;              // concrete, exact
  declaredPrior: Record<string, Rational>;
  exposure: "undisclosed" | "disclosed"
          | "transfer_hidden";
  novelty: "seen" | "new_skin" | "new_structure"
         | "new_domain";
}

interface GameState {
  instanceId: string; round: number;
  history: Record<string, string>[]; // profiles played
  automatonStates?: Record<string, string>;
  terminal: boolean;
  cumulativePayoff: Record<string, Rational>;
}
```

### 8.4 Attempts and evidence

```
type ErrorCode =                        // fixed taxonomy, 7.6.2
  | "MISREAD_PAYOFF_OWNER" | "INCOMPLETE_COMPARISON"
  | "ACROSS_NOT_WITHIN" | "IGNORED_OPPONENT_INCENTIVE"
  | "NOT_BR_TO_OWN_PREDICTION" | "CONFUSED_NE_WITH_OPTIMUM"
  | "NE_AS_PREDICTION" | "NE_AS_RECOMMENDATION"
  | "MISSED_MULTIPLE_EQUILIBRIA" | "NO_EQUILIBRIUM_CLAIM"
  | "DOMINANCE_FROM_OUTCOME" | "ASSUMED_BINDING_AGREEMENT"
  | "IGNORED_CONTINUATION" | "FINITE_HORIZON_OVERLOOKED"
  | "PD_OVERLABEL" | "OUTCOME_BIAS"
  | "MODEL_MISSING_PLAYER" | "MODEL_EXTRA_PLAYER"
  | "MODEL_WRONG_TIMING" | "MODEL_WRONG_INFO"
  | "MODEL_WRONG_RANKING";

interface Prediction {
  id: string; attemptId: string; round?: number;
  distribution: Record<string, number>;  // sums to 1
  confidenceLevel?: 0.5|0.6|0.7|0.8|0.9|0.99; // binary
  realisedAction?: string;
  brier?: number; logScore?: number;     // derived
}

interface Decision {
  id: string; attemptId: string; round?: number;
  action: string;             // or strategy/automaton id
  hintsUsed: number; msTaken: number;
  dq: { prior: Rational;      // normalised regret 0..1
        ownBelief: Rational;
        isEquilibriumAction: boolean };
  realisedPayoff: Rational;
}

interface ExplanationItem {          // authored content
  id: string; version: number;
  conceptId: string;
  type: "tap_to_justify" | "reason_choice"
      | "step_assembly" | "fill_in" | "own_words";
  prompt: TemplateString;            // slots from facts
  options?: { id: string; text: TemplateString;
              correct: boolean; code?: ErrorCode }[][];
                                      // >= 2 parallel sets
  steps?: { id: string; text: TemplateString;
            required: boolean; code?: ErrorCode }[];
  slots?: { id: string; source: FactRef;
            knownWrong?: { source: FactRef;
                           code: ErrorCode }[] }[];
  modelAnswer?: TemplateString;      // own_words only
  rubricId?: string;
}

interface StructuredResponse {
  id: string; attemptId: string;
  itemId: string; itemVersion: number;
  response: unknown;                 // cells/option/steps/slots
  correct: boolean; partial?: number; // 0..1
  codes: ErrorCode[];                // deterministic
}

interface SelfAssessment {
  id: string; attemptId: string; freeText: string;
  rubricId: string; rubricVersion: number;
  criteriaTicked: string[];
  corroboratedBy?: string;           // StructuredResponse id
}

interface FeedbackTemplate {        // authored content
  key: { conceptId: string; itemType: string;
         code: ErrorCode | "CORRECT" };
  exposure: "undisclosed" | "disclosed" | "any";
  phrasings: TemplateString[];       // 2-3, rotated by seed
  version: number;
}

interface ReviewItem {
  conceptId: string; dimension: Dimension;
  dueAt: string; priority: number;   // derived
  reason: ("low_mastery" | "recent_error"
    | "prediction_failure" | "weak_explanation"
    | "error_code_followup" | "interval_due")[];
}
```

### 8.5 Projections, patterns and the real-world worksheet

```
interface MasteryState {              // per concept x dimension
  conceptId: string; dimension: Dimension;
  score: number;                      // 0..100 stored
  uncertainty: number;                // e.g. posterior SD
  band: "not_started" | "emerging" | "developing"
      | "secure" | "mastered";
  evidenceCount: number;
  engineCheckedCount: number;         // excludes self-assessed
  lastEvidenceAt?: string;
  delayedSuccess: boolean;            // >= 3 days later
  algorithmVersion: string;
}

interface SelfAssessmentAccuracy {    // per concept
  conceptId: string; n: number;
  agreement: number;                  // self vs engine-checked
  weightMultiplier: number;           // 0..1, feeds mastery
}

interface DecisionPattern {
  patternId: string;                  // from fixed catalogue
  evidenceRefs: string[];             // event ids
  n: number; statistic: number;
  statisticKind: string;              // e.g. "calib_gap"
  interval: [number, number];
  confidence: "low" | "moderate" | "high";
  interpretationTemplateId: string;   // authored, linted
  status: "candidate" | "supported" | "retired";
}

interface LearningEvent {
  id: string; type: string; at: string; userId: string;
  appVersion: string; engineVersion: string;
  contentVersion: string; schemaVersion: number;
  templateId?: string; templateVersion?: number;
  skinId?: string; paramsHash?: string; seed?: string;
  payload: unknown;                   // typed per event
}

type EpistemicTag = "KNOWN" | "ASSUMED"
                   | "INFERRED" | "UNCERTAIN";

interface RealWorldWorksheet {        // separate local store
  id: string; createdAt: string; title: string;
  statements: { id: string; prompt: string; // which field
    text: string; tag: EpistemicTag }[];    // user-tagged
  structure: {                        // picker inputs
    keyPlayers: 1 | 2 | "3+";
    timing: "simultaneous" | "sequential_observed"
          | "sequential_unobserved" | "unclear";
    repeated: "one_off" | "repeated_known_end"
            | "repeated_open_ended" | "unclear";
    bindingAgreements: "yes" | "no" | "unclear";
    ranking?: { A: string[]; B: string[] }; // 2x2 only
  };
  candidateModels: { family: string;
    matchedOn: string[]; caveats: string[] }[]; // derived
  checklistDone: string[];
  // invariant: never synced, never in default export
}
```

### 8.6 Entity relationships

```
User 1---* LearningEvent *---1 ScenarioInstance
                                   |*
                                   1
                        ScenarioTemplate *---* Concept
                          |1       |*            |1
                          *        *             *
                        Skin  ExplanationItem  MasteryState
                                   |*                (projection)
                                   *
                             FeedbackTemplate (by concept,
                                               item type, error code)
Attempt (= events sharing attemptId)
  1---* Prediction  1---* Decision
  1---* StructuredResponse  1---* SelfAssessment
Concept *---* ReviewItem (projection)
DecisionPattern *---* LearningEvent (evidenceRefs)
RealWorldWorksheet: no links to any other entity (isolated)
```

### 8.7 Mastery model

**Evidence tagging.** Every piece of evidence is tagged with concept, dimension, difficulty (1–5),
scaffolding level (none / hint / worked example), novelty (seen / new skin / new structure / new
domain), response type (engine-checked generative, engine-checked selective, self-assessed), and
delay since the concept was last practised.

**What counts for each dimension:**

| Dimension | Evidence | Rules |
|---|---|---|
| Understanding | Engine-checked structured explanations (tap-to-justify, step assembly, fill-in); model builder; reason-choice items; free-text self-assessment | Reason choice and other selected-response items at most 30% of the score; self-assessment at most 15%, weight 0.25 × self-assessment-accuracy multiplier, and only when corroborated; **self-assessment alone can never raise Understanding**; no band above Developing without ≥ 3 engine-checked generative items |
| Recognition | Discrimination items: "which of these situations has property X?", including contrast games as negatives | Must include negatives; chance-corrected (a guess earns nothing) |
| Application | Correct best-response / dominance / equilibrium identification in play; decision quality against the declared prior; prediction consistency | Scaffolded items weighted lower |
| Transfer | Items with new structure or new domain, concept name not shown | Only `new_structure` or `new_domain` with `transfer_hidden` exposure count |

**Scoring.** Each dimension's score is a recency- and difficulty-weighted estimate of the probability
of success on a fresh item of moderate difficulty, with an uncertainty estimate (a weighted
Beta-binomial update is sufficient for V1 and transparent). Stored 0–100; displayed as bands:

| Band | Rule (initial values, to be tuned) |
|---|---|
| Not started | No evidence |
| Emerging | Score < 40, or fewer than 2 evidence items |
| Developing | 40–64 |
| Secure | ≥ 65 with ≥ 3 engine-checked items |
| Mastered | See below |

**Mastered (concept level)** requires all of:

- all four dimensions ≥ 75 and none below 65;
- at least 4 independent engine-checked evidence items per dimension;
- at least one success after a delay of ≥ 3 days since last practice of that concept;
- at least one transfer success in a new domain;
- uncertainty below a set level (a few lucky successes cannot produce "mastered").

**Decay.** Confidence in a score decays with time since last evidence (half-life 30–60 days), so
mastery must be maintained by retrieval. The UI says "due for re-check" rather than "lost".

All thresholds are configuration, recorded with an algorithm version, and recomputable from the event
log.

### 8.8 Scheduling

- **Priority score** per concept-dimension = weighted sum of: low mastery, recent errors, prediction
  failures (high Brier), weak structured-explanation results, and overdue interval. Specific error
  codes also schedule short targeted follow-up items (for example `INCOMPLETE_COMPARISON` → an item
  on comparing within columns). Prerequisites must be at least "developing" before transfer items are
  scheduled.
- **Expanding intervals** at concept level (FSRS- or SM-2-like): after a success the next review
  interval grows (for example 1 → 3 → 7 → 16 → 35 days); after a failure it resets short.
- **Never identical:** each review draws a new instance — new parameters, new skin, or new seat — and
  transfer reviews draw new structures where budget allows.
- **Interleave:** a review set mixes concepts and includes at least one contrast game, so the user must
  first identify *which* concept applies.
- **Cap:** daily review queue limited (default 5), new learning always available.

## 9. V1 user flow

### 9.1 Map

```
Onboarding
  purpose -> data stays on device -> install card
  -> confidence practice -> baseline (held-out, ~20-30 min)
    |
    v
Home ------------------------------------------------+
  Today: review queue (<= 5) | Continue module         |
  Laboratory | Progress | Real-world worksheet         |
    |                                                  |
    v                                                  |
Module arc (per concept, across days)                  |
  1 Discovery scenario (name hidden)                   |
    predict -> decide -> observe + counterfactual       |
    -> explain back                                    |
  2 Reveal and formalise (LEARN)                        |
  3 Varied practice (new skins, seats, parameters)       |
  4 Recognition set (with contrast games)                |
  5 Modify / replay in the Laboratory                    |
  6 Delayed retrieval (>= 1-3 days)                      |
  7 Transfer item (new structure/domain, name hidden)    |
    |                                                  |
    v                                                  |
Review  <----------------------------------------------+
Progress: mastery map | calibration (locked until n)
         | Decision Patterns (locked until n)
Real-world worksheet: separate, labelled, device-only
```

### 9.2 Screens

**Onboarding (3–4 short screens + diagnostic).** Purpose in two sentences; "your data stays on this
phone — back it up by exporting" with an "I understand"; on iPhone, the one-time Add to Home Screen
card (and a note if running in a Safari tab); a 30-second practice on the confidence control; then
the baseline. No concept names appear.

**Home.** One column on phone. Top: "Today" card with the review count and an estimated time. Below:
"Continue: Module n, step m". Then Laboratory, Progress, Real-world worksheet as quiet list rows. A
single quiet line when relevant: "Last backup 16 days ago — export now" or "Update available — reload
when ready". No counters, badges or streaks.

**Scenario — Encounter.** Narrative text (80–150 words) with the user's role clearly marked.
Presentation: a payoff matrix, a narrative only (the user must build the model), or a round timeline
for repeated games.

**Scenario — Build the model** (Module 1 and selected later items). Players as chips (add / remove),
actions per player as cards, a timing selector (simultaneous / A then B, B observes / A then B, B
does not observe), and a ranking control for each player's outcomes. The engine compares the result
with the canonical model and accepted alternatives and reports differences by component, each mapped
to a `MODEL_*` code.

**Scenario — Mark best responses** (tap-to-mark). The user taps the cell(s) representing each
player's best response to each opponent action; marks are underline (row player) and dot (column
player) — shape, not only colour.

**Scenario — Predict.** Binary: two action cards and a confidence selector with discrete steps 50 /
60 / 70 / 80 / 90 / 99%. Three or more actions: a segmented bar the user drags to allocate 100%.

**Scenario — Decide.** Action cards; one tap to choose, a second to confirm. In repeated games: an
action per round, or (later items) a strategy choice first described in plain words.

**Scenario — Observe.** In this order: (1) decision quality under the information given, (2)
consistency with the user's own prediction, (3) equilibrium reference, (4) the outcome. Then the
counterfactual panel: "If you had chosen X: the other side would (still / instead) have done Y; your
payoff would have been Z; expected payoff under what you were told: W." The verdict uses exactly one
of: *inferior decision*, *superior decision*, *sound decision*, *unfavourable outcome*. All sentences
are engine-filled templates.

**Scenario — Explain (structured).** One or two explanation items per scenario, chosen by the arc
stage:

- *In your own words* (optional on most items, required on discovery items): a short text box; on
  submit, the model answer appears beside the user's text with the rubric checklist to tick.
- *Then* an engine-checked item: tap-to-justify on the matrix, a fill-in sentence with number and
  action slots, a step-assembly list (drag to order; unused steps stay in a tray), or a reason choice.
- Feedback appears immediately below, specific to the error code and filled with the instance's
  numbers, with a small "this didn't help" link.

**Reveal and formalise (LEARN).** Short authored formal page: name, definition, the example the user
just played (numbers inserted by the engine), one contrast example, the discipline label, and one
"common misreading" note. Two to four screens.

**Repeated game — Timeline.** Horizontal round strip with both players' actions per round as labelled
glyphs, cumulative payoffs, a continuation indicator ("continues with probability 0.9 after each
round"), and prediction entry for the next round.

**Laboratory.** A 2×2 (or 2×3) matrix with each payoff editable via stepper or slider; live panel
showing best-response marks, dominance, pure and mixed equilibria, Pareto-efficient cells, game
family ("now a Stag Hunt"), and for repeated mode a δ slider with the grim-trigger threshold marked.
"Change the Game" items set a goal ("make mutual cooperation an equilibrium by changing one payoff")
and the engine checks it.

**Progress.** Mastery map: six concepts × four dimensions, bands as labelled segments. Calibration:
reliability chart with intervals (locked behind a progress indicator — "calibration feedback unlocks
after about 100 predictions; you have 37"). Decision Patterns: supported patterns only, each
expandable to Pattern / Evidence / n / Confidence / Possible interpretation. Settings: storage status,
last export, export/import, erase all data.

**Real-world worksheet.** Visually distinct, with the banner "Stays on this device. Do not enter
classified, operational, investigative or personal data." Steps:

1. *Guided prompts*, one per screen: who are the key players (roles, not names); what each wants;
   available actions; who knows what, and when; what is uncertain; incentives; is the interaction
   repeated, and is the end known; alternatives each side has; **what happens if nobody acts**.
2. *Epistemic tagging*: every statement the user writes carries a tag the **user** chooses — KNOWN /
   ASSUMED / INFERRED / UNCERTAIN — via four buttons beside the statement (no default, so a choice is
   forced). The output groups statements by tag.
3. *Structural checklist*: short yes/no/unclear questions — Are there really only two players? Can
   either side observe the other's move before acting? Are agreements enforceable? Is the interaction
   repeated, and is the end known? Is anyone's best choice independent of what others do? Unanswered
   or "unclear" items are listed as uncertainties.
4. *Candidate-model picker*: from the checklist answers (and, optionally, a ranking of four outcomes
   for each side if the situation is plausibly 2×2), the app lists game families consistent with the
   answers — for example, "If your rankings are right, this has the structure of a Stag Hunt: both
   prefer joint action, but each fears acting alone." Each candidate shows what it matched on, what
   would change the classification ("if both sides would rather free-ride on the other's commitment
   than act jointly, this becomes a Prisoner's Dilemma"), and a fixed caveat: **"This is a possible
   model, not a finding. No equilibrium is claimed."** The app never states an equilibrium for a
   real-world situation.
5. *Output sheet*: Known / Assumptions / Possible models / Strategic considerations (authored prompts
   per family, e.g. for Stag Hunt: "what would give each side assurance?") / Uncertainties. Stored on
   the device only.

### 9.3 Mobile layout notes

- Design width 360 px; matrices up to 3×3 must fit without horizontal scroll, using abbreviated
  action labels with a legend.
- Thumb zone: primary actions at the bottom; confirm buttons never adjacent to destructive ones.
- Typography: one serif or humanist sans for body, a tabular-figure font for payoffs; generous line
  height; restrained palette (near-black, off-white, one accent, one warning colour).
- Dark mode supported.
- Desktop: same flow, two-column layout (scenario left, matrix/analysis right).

## 10. V1 scenario architecture

### 10.1 Template, skin, instance

- **Template (structure):** the game skeleton with parameters, invariants, information given,
  opponent spec, counterfactuals and assessment role. Written once, validated in CI.
- **Skin:** narrative domain, roles, action labels, story text, optional round narration, tone rating;
  checked by the content lint for forbidden terms. A skin is attachable to any template whose
  structure it fits (declared by action-count and role compatibility).
- **Instance:** template × skin × parameter draw × seat × prior, generated deterministically from a
  seed. The engine computes the analysis; **analysis is not hand-written** except for the pedagogical
  commentary in the reveal step.

### 10.2 Template fields

| Field | Purpose |
|---|---|
| `id, version` | Identity; version recorded on every event |
| `concepts` | Concept ids taught or tested |
| `discipline` | GT / DT / BGT / BE / COMPUTATIONAL / OUTSIDE_FORMAL |
| `family` | Structure family (PD, Stag Hunt, Chicken, …, or `model_building`) |
| `game` | Game definition with symbolic parameters |
| `params` | Ranges (integers or simple fractions) |
| `invariants` | Properties that must hold for every draw |
| `info_given` | What the user is told: matrix visible?, opponent description, declared prior, history |
| `opponent` | True policy and its relation to the prior |
| `sequence` | Simultaneous, observed sequential (two-stage), repeated |
| `rules` | Text rules shown to user (must match the game definition) |
| `difficulty` | Factors: matrix size, payoff scale, ties, distractor dominance, narrative-only |
| `counterfactuals` | Which alternatives to compute and show |
| `explanation_items` | Explanation item ids, by arc stage |
| `interpretation` | Authored interpretation note (template string) for the reveal and observe steps |
| `skins` | Compatible skin ids |
| `contrast_with` | Sibling templates for discrimination items |
| `role` | discovery / practice / recognition / transfer / held_out |
| `rubric` | Rubric and model-answer ids for free text |

### 10.3 Example template (illustrative)

```
id: sd.pd.oneshot.basic
version: 3
concepts: [dominant_strategy, nash_equilibrium,
           social_dilemma]
discipline: GT
family: PD
role: practice
game:
  kind: normal
  scale: cardinal
  players: [A, B]
  actions: { A: [c, d], B: [c, d] }
  payoffs:              # (A, B)
    "c,c": [R, R]
    "c,d": [S, T]
    "d,c": [T, S]
    "d,d": [P, P]
params:
  T: { int: [5, 9] }
  R: { int: [3, 7] }
  P: { int: [1, 4] }
  S: { int: [-2, 2] }
invariants:
  - "T > R > P > S"           # defines the PD
  - "2*R > T + S"              # needed if repeated
  - engine.family == "PD"     # classifier agrees
  - engine.strictly_dominant(A) == d
  - engine.pure_ne == [[d, d]]
  - engine.pareto_inefficient([d, d])
info_given:
  matrix_visible: true
  opponent_description: >
    The other side chooses without knowing
    your choice.
  declared_prior: { c: p_c, d: "1 - p_c" }
opponent:
  policy: fixed_mix
  mix: same_as_declared_prior
  extra_params: { p_c: { choice: [0.3, 0.5, 0.7] } }
sequence: simultaneous
difficulty: { size: 1, ties: 0, narrative_only: 0 }
counterfactuals: [other_action, both_cooperate]
explanation_items:
  practice: [ex.dom.own_words.v1, ex.dom.tap_justify.v2,
             ex.dom.fill_in.v1]
  recognition: [ex.sd.reason_choice.v3]
interpretation: interp.sd.pd.basic.v2
skins: [shipping_rates, fisheries_quota,
        neighbouring_districts_overtime,
        exam_study_group, cross_border_tariffs]
contrast_with: [sd.stag.oneshot.basic,
                sd.chicken.oneshot.basic,
                sd.harmony.oneshot.basic]
rubric: rb.dominance_vs_collective.v2
```

A skin (illustrative):

```
id: fisheries_quota
version: 2
fits: { players: 2, actions_per_player: 2 }
domain: ecology
tone: neutral
roles: { A: "Your cooperative", B: "Rival cooperative" }
action_labels: { c: "Keep to the quota",
                 d: "Fish beyond the quota" }
story: >
  Two fishing cooperatives share a bay ...
round_narration:              # repeated-game skins only
  both_c: "Both boats return within quota."
```

A reason-choice explanation item (illustrative):

```
id: ex.sd.reason_choice.v3
concept: nash_equilibrium
type: reason_choice
prompt: >
  Why is ({a_d}, {b_d}) the outcome neither side
  would move away from alone?
option_sets:
  - - text: "Whatever the other does, switching
             to {a_c} lowers your payoff."
      correct: true
    - text: "It gives the two sides the highest
             combined payoff."
      code: CONFUSED_NE_WITH_OPTIMUM
    - text: "It is what the other side is most
             likely to choose."
      code: NE_AS_PREDICTION
    - text: "Last time it led to a good result
             for you."
      code: DOMINANCE_FROM_OUTCOME
  - [ ... second parallel set ... ]
```

Forbidden terms are not declared per skin: they are declared once per concept and enforced by the
content lint (10.4). Note the PD template's invariant `2R > T + S`: not required for a one-shot PD,
but enforcing it keeps every PD instance reusable in Module 6.

### 10.4 Validator and content lint

The validator and lint run in CI on every change and block deployment on failure.

**Validator (structure):**

1. Schema conformance of templates, skins, explanation items, feedback templates, rubrics and reveal
   pages.
2. **Invariants hold for every parameter draw** — exhaustively when the parameter space is small (it
   usually is), otherwise for a large seeded sample plus boundary values.
3. The engine's game classifier agrees with the declared family.
4. Every attached skin is structurally compatible; rules text references only existing actions.
5. Declared prior is a valid distribution; the opponent's relation to it is declared.
6. Ordinal-scale templates request no mixed-equilibrium or expected-value counterfactuals or feedback.
7. Held-out templates and skins share no (structure, skin) pair with practice content.
8. Minimum content counts per concept and role are met (10.6).
9. **Explanation items:** every distractor, wrong step and known-wrong slot source maps to exactly one
   defined error code; exactly one correct option per set; ≥ 2 parallel option sets; slot sources
   exist in AnalysisFacts; correct answers verified against the engine for every parameter sample (a
   "correct" option must actually be correct for every draw).
10. **Feedback coverage:** for every (concept, item type, code) that items can produce there is a
    feedback template, plus a `CORRECT` one.

**Content lint (language):**

1. **Forbidden terms:** no concept name or synonym in any string reachable in an undisclosed- or
   transfer-hidden state — checked on skins, titles, prompts, options, steps, feedback, narration —
   checked on the raw strings and on rendered templates.
2. **Trait language** banned in pattern and feedback text ("you are", "aggressive person",
   "risk-taker", …).
3. **Outcome-judging phrasings** banned in decision-quality feedback ("you lost because you chose
   badly").
4. **Distractor form:** length within ±30% of the correct option; absolute words ("always", "never")
   flagged unless balanced.
5. **Style:** Indian English spelling list; maximum lengths for skins and feedback.

### 10.5 Scenario families per module

| Module | Concept(s) | Structure families (examples) |
|---|---|---|
| 1 Seeing the Game | Game modelling | Narrative-only builders: simultaneous 2-player; observed sequential 2-stage (identify only); "spot the non-player"; "missing action"; "who knows what" |
| 2 Best Response | Best response to a pure action and to a belief | 2×2 and 2×3 with asymmetric payoffs; best response to declared prior; "their best response does not depend on yours" items |
| 3 Dominant Strategy | Strict dominance, IESDS; weak dominance as edge case | One player dominant only; both dominant; no dominant but IESDS solves (3×3); weak-dominance tie case |
| 4 Nash Equilibrium | NE as stability; multiple NE; mixed NE acknowledged; NE ≠ recommendation | Coordination; BoS; Stag Hunt; Chicken; Matching Pennies; "equilibrium play loses to this opponent" |
| 5 Social Dilemmas | Individual vs collective rationality; Pareto inefficiency; money vs utility | PD (several skins and parametrisations); PD vs Stag Hunt vs Chicken vs Harmony vs Deadlock discrimination; social-preference transform |
| 6 Repeated Interaction | Shadow of the future; δ threshold; strategies as automata; folk-theorem caution; finite-horizon unravelling (flagged) | Indefinite PD vs TFT / Grim / AllD / WSLS / Random; δ variation; known final round; "can cooperation be sustained here?" |
| Contrast (not a module) | Discrimination | Stag Hunt, Chicken, BoS, pure coordination, Matching Pennies, Harmony, Deadlock |

### 10.6 Content targets for V1

| Item type | Per module | Total (approx.) |
|---|---|---|
| Structure templates | 3–5 | 24 |
| Skins per structure | 4–6 | — |
| Distinct domains across skins | ≥ 6 | — |
| Contrast templates | — | 7 families × 1–2 = 10 |
| Discovery items | 1–2 | 10 |
| Transfer items (new structure/domain) | 4–6 | 30 |
| Held-out assessment items (never practised) | 6–8 | 45, in 3 parallel forms |
| Explanation items (all types) | 15–25 | ~120 |
| Feedback templates (keys × 2–3 phrasings) | 30–50 keys | ~250 keys, ~600 phrasings |
| Reveal pages and interpretation notes | 3–6 | ~30 |
| Rubrics with model answers | 2–3 | 15 |

This is the real workload of V1. Rough authoring estimate: a skin 20–30 minutes; an explanation item
with parallel option sets 30–45 minutes; a feedback key with phrasings 10–15 minutes. Total in the
order of **150–250 hours** of careful authoring and review across Phases 2, 5 and 9 — more than the
engine. Practice instances are effectively unlimited through parameters, seats and skins; transfer and
held-out items are finite and budgeted.

### 10.7 Discovery-item design rules

- The scenario must be *solvable by reasoning* without the concept name.
- The prediction step must be informative: the declared prior or opponent description must make some
  answers better than others.
- At least one counterfactual must expose the concept (for example, in a dominance discovery item:
  "whatever they do, the other choice gives you less").
- The reveal names the concept only after the explanation step.

## 11. Testing requirements

### 11.1 Engine — unit and golden tests

- Golden results for canonical games: PD, Stag Hunt, Chicken, BoS, pure coordination, Matching
  Pennies, Harmony, Deadlock, Rock–Paper–Scissors (pure NE: none; mixed: reported as not computed
  beyond 2×2), and a 3×3 IESDS-solvable game.
- 2×2 mixed equilibria: Matching Pennies (½, ½); BoS and Chicken (each mix value checked exactly as
  fractions); degenerate cases with ties.
- Grim-trigger threshold δ* = (T − R)/(T − P) for several payoff sets; simulation agrees with the
  analytic threshold just above and just below δ*.
- Finitely repeated PD: backward-induction result (defect in every round) on the flagged items.

### 11.2 Engine — property-based tests

- Adding a constant to all of one player's payoffs, or applying a **positive affine transformation**
  (a·u + b, a > 0) to one player's payoffs, leaves best responses, dominance, pure NE and mixed NE
  unchanged.
- Adding to player *i*'s payoffs any amount that depends only on the *other* player's action leaves
  player *i*'s best responses (and hence the NE set) unchanged.
- A **strictly increasing (monotone) transformation** preserves dominance and pure NE but may change
  mixed NE (test that the engine does not claim otherwise).
- If every player has a strictly dominant strategy, that profile is the unique NE.
- A strictly dominated action is never played with positive probability in any NE.
- Relabelling actions or swapping players permutes results correspondingly.
- Every pure NE survives strict IESDS.
- Classifier: 2×2 family is invariant under action relabelling and player swap where the family is
  symmetric.

### 11.3 Arithmetic and determinism

- Exact tie tests (payoffs like 1/3 + 1/3 + 1/3 = 1; values engineered to break floating-point).
- Same seed → identical instance, opponent draws and counterfactuals; different seed → different
  draws.
- Counterfactual re-simulation reuses random draws not affected by the changed action.

### 11.4 Content validator in CI

Every template satisfies its invariants for all parameter samples; every explanation item maps to the
taxonomy; feedback coverage is complete; content lint passes; held-out isolation holds; minimum
content counts met. A failure blocks deployment.

### 11.5 Learning layer

- Unit tests for mastery updates, bands, thresholds, decay, scheduler priorities and intervals, Brier
  and log scores, calibration bins and intervals, pattern statistics and gating.
- **Synthetic learner simulations:** simulated learners with known true skill (improving, static,
  guessing, overconfident) run through the scheduler for simulated months. Checks: a guessing learner
  never reaches "mastered"; an improving learner does, within a plausible number of items; a perfectly
  calibrated simulated predictor is never flagged as over- or underconfident more often than the
  declared error rate; patterns appear in noise at no more than the declared false-positive rate.

### 11.6 Content and feedback tests

- **Template rendering:** every feedback template, prompt, option and reveal page renders for every
  parameter sample of every compatible scenario template, with all slots resolved, numbers formatted
  exactly (fractions where exact, no rounding artefacts) and no empty or "undefined" output. Snapshot
  tests on a fixed set of instances.
- **Taxonomy mapping:** for each explanation item, scripted responses (each distractor, each wrong
  step, each known-wrong slot value, each wrong cell pattern) produce exactly the expected error
  codes; correct responses produce none.
- **Distractor validity:** for every parameter draw, the correct option is correct according to the
  engine and every distractor is incorrect according to the engine (catches templates whose numbers
  make a distractor accidentally true, for example a "highest total" option that coincides with the
  equilibrium).
- **Diagnosis determinism:** same response and instance always yield the same codes and the same
  rotated phrasing for a given seed.
- **Content lint:** forbidden terms, trait language, outcome-judging language, distractor form and
  style rules (10.4), run as tests with known-bad fixtures to prove the lint catches them.
- **Feedback coverage:** every code an item can produce has a template.
- **Pedagogical review checklist:** a human review (you, plus whoever authors content) of each new
  reveal page and feedback key against the misstatement checklist (E16), recorded in the content
  change.

### 11.7 App, PWA and deployment

- **Browsers:** Playwright end-to-end flows in **Chromium and WebKit** at mobile viewports (360 × 740,
  390 × 844) and a desktop viewport; manual check on at least one real Android and one real iPhone
  each phase from Phase 3.
- **Offline / service worker:** after first load, disable the network and complete a full scenario,
  lab experiment, review and export; verify no network requests are attempted after caching (request
  interception).
- **Install and upgrade:** deploy version N, start a scenario, deploy N+1; verify the update prompt
  appears only between scenarios, the in-progress attempt completes under N, migrations run once, and
  the automatic pre-migration export exists.
- **Base path and routing:** build with the production base, serve under `/<repo>/` on a Pages-like
  static server (no rewrites), and verify deep hash links, asset loading, manifest scope and
  service-worker scope; a smoke test also runs against the real deployed URL after each deploy.
- **Storage:** persistence request handled on both engines; export → erase → import reproduces
  identical projections; import of the same file twice is idempotent; schema migrations tested on
  fixtures from every prior version; behaviour when storage is unavailable or full is graceful.
- **Accessibility:** axe-core checks, screen-reader labels on matrix cells, keyboard navigation on
  desktop, touch-target sizes, non-colour signals.
- **Performance:** bundle-size budget in CI; Lighthouse mobile run against the deployed site (7.9).
- **Data safety:** real-world worksheets absent from the default export; encrypted export round-trips;
  "erase all data" leaves no records.
- **Dependency allow-list:** CI fails if a dependency outside the list is added (enforces C1 and C3).

### 11.8 Pedagogical pilot

Your own use is the pilot: baseline, then modules in sequence, periodic held-out assessments on
parallel forms, plus a short weekly self-report (two questions: what felt hard; what felt pointless).
Reviewed at the end of Phase 10 against the central hypothesis, with the multiple-baseline comparison
described in 3.4.

## 12. Deliberately NOT in V1

| Excluded | Reason | Status |
|---|---|---|
| **AI or language models of any kind** | Foundational constraint C1 | **Never, in any version** |
| Server, backend, accounts, analytics | Constraint C3 | Not planned |
| Sync between devices | No server; export/import instead | Out of scope; architecture keeps it possible (7.13) |
| Multiplayer / human vs human | Different product; needs a server | Not planned |
| More than 2 players | Combinatorial content and UI cost | V2 (public goods, commons) |
| Incomplete information, Bayesian games, types, signalling | Needs extensive-form engine and new pedagogy | V2; schema already reserved |
| General sequential games | Only a two-stage subset if the information lever is approved | V2 |
| Teaching mixed-strategy computation in depth | Acknowledged and computed for 2×2 only | V2 |
| Pattern detection outside the fixed catalogue | Multiple-comparisons noise; personality drift | Not planned |
| Communication and reputation levers | Need cheap-talk / incomplete-information models | V2; or labelled behavioural approximations if you insist |
| Evolutionary tournaments (Axelrod-style) | Computational content; secondary | V1.x optional lab feature |
| Points, badges, streaks, leaderboards | Distort incentives | Not planned |
| Push notifications | Attention cost; unreliable for web apps on iOS | Not planned; Home-screen reminders only |
| Voice interface | Phone keyboard dictation works | Not planned |
| Bengali / Hindi | Content cost; strings externalised now | Later |
| Later domains (DT, BE, negotiation, psychology, strategic communication, institutional design) | Scope | Later; V1 has explicit boundary notes only |

## 13. Phased implementation plan

Relative size: **S** ≈ 1 unit, **M** ≈ 2 units, **L** ≈ 3–4 units. A unit is not converted into weeks:
it depends on who does the work and how much review time you give each phase. Content authoring runs
alongside engineering from Phase 2 and is sized separately (10.6). Every phase from Phase 3 onwards
ends with a deployment to your GitHub Pages site that you can open on your phone.

### Phase 0 — Decisions and spikes (S)

- **Goal:** settle the blocking decisions and remove the platform unknowns.
- **Scope:** create the repository; a minimal static PWA ("hello" screen) deployed by GitHub Actions
  to Pages with the production base path and hash routing; install on an Android phone and an iPhone;
  test `navigator.storage.persist()` and home-screen vs Safari-tab storage separation on the iPhone;
  design prototype of a 3×3 matrix, confidence control and timeline on a 360 px screen; draft error
  taxonomy and content style guide.
- **Deliverables:** decision record; working Pages URL; spike notes on iOS storage; visual prototype;
  draft taxonomy and style guide.
- **Exit criteria:** blocking questions answered; the spike app installs and works offline on both
  phones; matrix prototype legible on your phone; taxonomy and style guide approved by you.

### Phase 1 — Game engine, model and tests (L)

- **Goal:** a correct, deterministic engine with no UI.
- **Scope:** rational arithmetic; seeded RNG; `normal` and `repeated` kinds; all engine functions in
  7.8 (two-stage `extensive` only if approved); AnalysisFacts.
- **Deliverables:** engine package; unit, golden and property test suites.
- **Exit criteria:** all tests in 11.1–11.3 pass; canonical games correct; property tests pass at high
  iteration counts; no floating-point in equilibrium code paths (lint rule).

### Phase 2 — Content system and Modules 1–3 content (M–L)

- **Goal:** the content pipeline proven before the UI, including all the deterministic replacements
  for AI.
- **Scope:** schemas for templates, skins, explanation items, feedback templates, rubrics and reveal
  pages; validator and content lint; instance generator; concept graph; `feedback` package (diagnosis
  and template filling); Modules 1–3 and contrast-family content; **provisional held-out set for
  Modules 1–3**.
- **Deliverables:** `content` and `feedback` packages; CI validation and lint; a readable content
  review document.
- **Exit criteria:** validator, lint and content tests (11.4, 11.6) pass; at least 3 structure
  templates × 4 skins per module for Modules 1–3, with explanation items and full feedback coverage;
  you have reviewed the skins and a sample of feedback.

### Phase 3 — Core play UI, PWA shell and structured explanation (M–L)

- **Goal:** play a scenario end to end on your phone, offline.
- **Scope:** matrix component (tap-to-mark, tap-to-justify), model builder, predict-with-confidence,
  decide, observe with DQ references and counterfactuals, all explanation item types, feedback
  display, reveal pages; manifest, service worker, update prompt, iOS install card; deploy pipeline
  with end-to-end tests.
- **Deliverables:** installable PWA on your Pages URL (session-only state).
- **Exit criteria:** you complete a Module 2 discovery-to-practice sequence on your phone in under 15
  minutes; Playwright suites pass on Chromium and WebKit; offline play works; performance budget met.

### Phase 4 — Persistence, export/import, mastery and calibration (M)

- **Goal:** a trustworthy learning record on the device.
- **Scope:** `storage` and `learning` packages; event schemas with version stamps; IndexedDB;
  persistence request; export/import with merge; pre-migration auto-export; backup reminder; mastery
  (with self-assessment rules); calibration and self-assessment-accuracy projections; basic Progress
  view.
- **Deliverables:** persistent app; synthetic-learner simulation suite.
- **Exit criteria:** export → erase → import reproduces identical projections on both engines;
  synthetic-learner checks pass (11.5), including "self-assessment alone cannot raise Understanding";
  upgrade test passes.
- **Milestone: vertical slice.** Modules 1–3 run end to end on your phone — discovery, prediction,
  decision, counterfactual, structured explanation with feedback, persistence, mastery — fully
  offline. **Take the provisional held-out baseline first, then use the slice for two to three weeks
  before Phase 5.** Your experience should reshape the remaining phases.

### Phase 5 — Modules 4–6: Nash, Social Dilemmas, Repeated Interaction (L)

- **Goal:** complete V1 content and the repeated-game experience.
- **Scope:** templates, skins, explanation items and feedback for Modules 4–6; opponent automata with
  discipline labels; timeline UI; strategy-commitment choice; δ and finite-horizon items;
  money-versus-utility boundary lesson.
- **Deliverables:** all six modules playable.
- **Exit criteria:** validator, lint and content tests pass; repeated-game simulations match analytic
  thresholds; your review of Module 5–6 labels (TFT, folk theorem, finite horizon).

### Phase 6 — Strategy Laboratory and Changing Incentives (M)

- **Goal:** manipulate games and see incentives change.
- **Scope:** editable 2×2/2×3 matrix with live analysis; δ slider; payoff / reward / penalty / 
  repetition levers; information/timing lever (if approved); goal-directed "Change the Game" items
  with engine checks and templated feedback.
- **Deliverables:** Laboratory screen; 10–15 goal items.
- **Exit criteria:** lab updates within 50 ms on a mid-range Android phone; goal checks verified by
  tests.

### Phase 7 — Review scheduler, Decision Patterns, calibration views (M)

- **Goal:** spaced, interleaved retrieval and gated insight.
- **Scope:** scheduler including error-code follow-ups; review sessions; calibration chart with
  intervals; fixed pattern catalogue with gating, statistics and authored interpretation templates.
- **Deliverables:** Review and Progress screens complete.
- **Exit criteria:** no identical item repeated over 6 simulated months; pattern false-positive rate
  in noise within the declared bound; locked states show real counts.

### Phase 8 — Real-world worksheet (S–M)

- **Goal:** structured analysis of real situations that never leaves the device.
- **Scope:** separate store; guided prompts; user-applied epistemic tags; structural checklist;
  candidate-model picker with caveats; strategic-consideration prompts per family; output sheet;
  separate and optionally encrypted export; placeholder check; erase.
- **Deliverables:** worksheet screens and warning text.
- **Exit criteria:** tests confirm worksheets are absent from default exports and that no network
  requests occur; picker never outputs an equilibrium claim (tested over all answer combinations); you
  have approved the warning text.

### Phase 9 — Held-out assessment, polish, accessibility, pilot (M)

- **Goal:** measure, finish and start the real trial.
- **Scope:** full held-out bank in three parallel forms; baseline and periodic assessment flow;
  multiple-baseline reporting view; accessibility audit; performance pass; documentation of data and
  content formats.
- **Deliverables:** V1 release on your Pages URL; assessment report template.
- **Exit criteria:** all suites green; accessibility audit passes; full baseline taken for Modules 4–6;
  periodic assessment cycle scheduled.

### Phase summary

| Phase | Name | Size | Usable result |
|---|---|---|---|
| 0 | Decisions and spikes | S | Live Pages URL, decisions |
| 1 | Engine + tests | L | — (library) |
| 2 | Content system, Modules 1–3 | M–L | Reviewable content |
| 3 | Play UI, PWA, explanations | M–L | Offline play on phone |
| 4 | Persistence and mastery | M | **Vertical slice, Modules 1–3** |
| 5 | Modules 4–6 | L | Full curriculum |
| 6 | Laboratory | M | Change the Game |
| 7 | Review and patterns | M | Spaced retrieval |
| 8 | Real-world worksheet | S–M | Device-only transfer tool |
| 9 | Assessment and pilot | M | V1 release |

## 14. Decisions needed from you

Resolved since revision 1: platform (static PWA on GitHub Pages, Android and iPhone), single user
without login, and every AI-related question (no AI in any version). Questions marked **(blocking)**
must be answered before Phase 0 can close.

1. **GitHub account and repository name (blocking).** What is your GitHub username, and what should
   the repository be called? Together they fix the address `https://<username>.github.io/<repo>/`.
   Changing it later changes where your data lives on the phone (export and import would be needed),
   so choose once.
2. **Public repository (blocking).** On a free account the repository must be public. It will contain
   only app code and authored content, never your data. Is that acceptable, or would you rather pay
   for a plan that allows Pages from a private repository?
3. **Custom domain and isolation (blocking).** Use `github.io` (default) or a custom domain? And will
   you host any other project sites on the same GitHub account? If yes, a custom domain or a dedicated
   account is recommended, because all project sites on one account share browser storage (7.9).
4. **Scenario skins (blocking).** May skins include *fictional, generic* policing, public-order or
   public-administration contexts (for example communal or political themes in West Bengal)? Are any
   domains off-limits? Will you review skins in batches as they are written?
5. **Session length.** Is 10–15 minutes per day realistic? How many days per week?
6. **Module 5 reframe.** Do you accept "Social Dilemmas", with the PD as anchor, in place of
   "Prisoner's Dilemma"?
7. **Contrast games.** Do you accept Stag Hunt, Chicken, Battle of the Sexes, coordination, Matching
   Pennies, Harmony and Deadlock as non-module contrast scenarios in V1?
8. **Information/timing lever.** Include the minimal two-stage sequential model (simultaneous versus
   observed moves), at a cost of roughly one extra M-sized unit spread across Phases 1, 5 and 6?
9. **Communication and reputation.** Defer to V2 (recommended), or include as explicitly labelled
   behavioural approximations?
10. **Mastery thresholds.** Accept the proposed rules (all four dimensions ≥ 75, none < 65, ≥ 4
    engine-checked items each, a delayed success, a new-domain transfer success; self-assessment
    weighted low, corroborated, and never sufficient alone) as starting values to be tuned from your
    data?
11. **Module titles and name-hiding.** Neutral working titles before discovery (recommended), or real
    names visible with name-hiding only inside items? And do you want an "I know this — test me" skip
    option?
12. **Evaluation.** Do you accept a 20–30 minute baseline before using the app (a provisional one for
    Modules 1–3 before the Phase 4 slice), and a 20-minute held-out assessment every 3–4 weeks?

**Implementation will not begin until you, Wangden Bhutia, have reviewed this plan, answered the
blocking questions in Section 14, and given explicit approval.**
