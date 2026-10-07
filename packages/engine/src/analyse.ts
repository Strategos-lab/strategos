/**
 * The analysis facade: one call returns every engine fact future UI and feedback
 * templates may show (plan §7.6.1). `analyse` returns plain JSON (rationals as
 * strings); `analyseExact` returns the same structure with Rational values.
 */
import { bestResponseTable, type BestResponseRow } from './bestResponse.js';
import { classifyFamily, type FamilyClassification } from './classify.js';
import { compile, type MatrixGame } from './compile.js';
import { dominance, iesds, iteratedWeakDominance, type IteratedEliminationResult, type PlayerDominance } from './dominance.js';
import { indifference2x2, solveEquilibria, type EquilibriumSet, type Indifference2x2 } from './equilibria.js';
import { expectedPayoffs } from './expected.js';
import { paretoAnalysis, type ParetoAnalysis } from './pareto.js';
import { Rational } from './rational.js';
import {
  finiteHorizonUnravelling,
  grimTriggerThreshold,
  isGrimSustainable,
  type FiniteHorizonUnravelling,
  type GrimSustainability,
  type GrimThreshold,
} from './repeated.js';
import { compareWithSimultaneous, followerBestResponses, toSimultaneous, type SequentialComparison } from './sequential.js';
import { toJSONValue, type Jsonify } from './serialise.js';
import { SCHEMA_VERSION, type GameDefinition, type Horizon, type PayoffScale } from './types.js';
import { assertValidGame } from './validate.js';
import { ENGINE_VERSION } from './version.js';

export interface MatrixAnalysis {
  dimensions: [number, number];
  payoffScale: PayoffScale;
  bestResponses: [BestResponseRow[], BestResponseRow[]];
  dominance: [PlayerDominance, PlayerDominance];
  iesds: IteratedEliminationResult;
  iteratedWeakDominance: IteratedEliminationResult & { orderSearchComplete: boolean };
  equilibria: EquilibriumSet;
  equilibriumPayoffs: { pure: [Rational, Rational][]; mixed: [Rational, Rational][] };
  /**
   * Mixed-equilibrium probabilities and expected values are meaningful only for cardinal payoffs.
   * For ordinal games the EXISTENCE of the mixed equilibria is still a fact (and is reported),
   * but their probabilities must not be shown as feedback.
   */
  mixedProbabilitiesMeaningful: boolean;
  pareto: ParetoAnalysis;
  family: FamilyClassification;
  indifference2x2: Indifference2x2 | null;
}

export interface SequentialAnalysis {
  followerBestResponses: number[][];
  comparison: SequentialComparison;
}

export interface RepeatedAnalysis {
  horizon: Horizon;
  grimThreshold: GrimThreshold;
  /** Grim sustainability at the game's delta (continuation horizon with a PD stage game only). */
  grimAtDelta: GrimSustainability | null;
  finiteHorizon: FiniteHorizonUnravelling;
}

export interface AnalysisExact {
  engineVersion: string;
  schemaVersion: typeof SCHEMA_VERSION;
  kind: GameDefinition['kind'];
  /** What `matrix` describes: the game itself, the simultaneous version of a sequential game, or the stage game. */
  matrixRole: 'game' | 'simultaneous-version' | 'stage-game';
  matrix: MatrixAnalysis;
  sequential: SequentialAnalysis | null;
  repeated: RepeatedAnalysis | null;
}

/** JSON form consumed by UI and feedback templates. */
export type AnalysisFacts = Jsonify<AnalysisExact>;

export function analyseMatrix(game: MatrixGame): MatrixAnalysis {
  const bm = compile(game);
  const equilibria = solveEquilibria(game);
  return {
    dimensions: [bm.m, bm.n],
    payoffScale: game.payoffScale,
    bestResponses: [bestResponseTable(game, 0), bestResponseTable(game, 1)],
    dominance: [dominance(game, 0), dominance(game, 1)],
    iesds: iesds(game),
    iteratedWeakDominance: iteratedWeakDominance(game),
    equilibria,
    equilibriumPayoffs: {
      pure: equilibria.pure.map(([i, j]) => [bm.A[i]![j]!, bm.B[i]![j]!]),
      mixed: equilibria.mixed.map((mp) => expectedPayoffs(game, mp)),
    },
    mixedProbabilitiesMeaningful: game.payoffScale === 'cardinal',
    pareto: paretoAnalysis(game, equilibria),
    family: classifyFamily(game),
    indifference2x2: bm.m === 2 && bm.n === 2 ? indifference2x2(game) : null,
  };
}

export function analyseExact(game: GameDefinition): AnalysisExact {
  assertValidGame(game);
  const base = { engineVersion: ENGINE_VERSION, schemaVersion: SCHEMA_VERSION, kind: game.kind };
  switch (game.kind) {
    case 'normal':
      return { ...base, matrixRole: 'game', matrix: analyseMatrix(game), sequential: null, repeated: null };
    case 'sequential2':
      return {
        ...base,
        matrixRole: 'simultaneous-version',
        matrix: analyseMatrix(toSimultaneous(game)),
        sequential: { followerBestResponses: followerBestResponses(game), comparison: compareWithSimultaneous(game) },
        repeated: null,
      };
    case 'repeated': {
      const th = grimTriggerThreshold(game.stage);
      return {
        ...base,
        matrixRole: 'stage-game',
        matrix: analyseMatrix(game.stage),
        sequential: null,
        repeated: {
          horizon: game.horizon,
          grimThreshold: th,
          grimAtDelta:
            th.applicable && game.horizon.type === 'continuation'
              ? isGrimSustainable(game.stage, Rational.parse(game.horizon.delta))
              : null,
          finiteHorizon: finiteHorizonUnravelling(game),
        },
      };
    }
  }
}

/** Analyse any game definition; returns JSON-serialisable AnalysisFacts. */
export function analyse(game: GameDefinition): AnalysisFacts {
  return toJSONValue(analyseExact(game));
}
