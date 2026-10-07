/**
 * Counterfactuals for one-shot games: what each alternative own action would have paid
 * against the SAME realised opponent action, and how a reactive opponent would respond.
 */
import { bestResponses } from './bestResponse.js';
import { compile, assertPlayer, assertAction, actionCount, type MatrixGame } from './compile.js';
import type { Rational } from './rational.js';
import type { Profile } from './types.js';

export interface CounterfactualRow {
  action: number;
  /** Profile with this own action and the realised opponent action. */
  profile: Profile;
  payoffs: [Rational, Rational];
  /** Own payoff minus own realised payoff. */
  ownDifference: Rational;
  /**
   * How the opponent would respond to this action if it could react:
   *  - sequential2, user = leader: the follower's actual best responses (the game's real dynamics);
   *  - normal games: a HYPOTHETICAL opponent who observed the action and best-responded (not the game as played);
   *  - sequential2, user = follower: null (the leader moved first and cannot react).
   */
  reactiveOpponent: { responses: number[]; outcomes: { profile: Profile; payoffs: [Rational, Rational] }[] } | null;
}

export interface Counterfactuals {
  player: 0 | 1;
  realised: Profile;
  realisedPayoffs: [Rational, Rational];
  reactiveModel: 'hypothetical-observing-best-response' | 'follower-best-response' | 'none';
  alternatives: CounterfactualRow[];
}

export function counterfactuals(game: MatrixGame, player: number, realised: Profile): Counterfactuals {
  assertPlayer(player);
  const bm = compile(game);
  assertAction(bm, 0, realised[0]);
  assertAction(bm, 1, realised[1]);
  const opp = (1 - player) as 0 | 1;
  const at = (p: Profile): [Rational, Rational] => [bm.A[p[0]]![p[1]]!, bm.B[p[0]]![p[1]]!];
  const mk = (own: number, o: number): Profile => (player === 0 ? [own, o] : [o, own]);
  const realisedPayoffs = at(realised);
  const reactiveModel: Counterfactuals['reactiveModel'] =
    game.kind === 'normal' ? 'hypothetical-observing-best-response' : player === 0 ? 'follower-best-response' : 'none';
  const alternatives: CounterfactualRow[] = [];
  for (let a = 0; a < actionCount(bm, player); a++) {
    const profile = mk(a, realised[opp]);
    const payoffs = at(profile);
    let reactiveOpponent: CounterfactualRow['reactiveOpponent'] = null;
    if (reactiveModel !== 'none') {
      const responses = bestResponses(game, opp, a);
      reactiveOpponent = {
        responses,
        outcomes: responses.map((b) => {
          const p = mk(a, b);
          return { profile: p, payoffs: at(p) };
        }),
      };
    }
    alternatives.push({
      action: a,
      profile,
      payoffs,
      ownDifference: payoffs[player]!.sub(realisedPayoffs[player]!),
      reactiveOpponent,
    });
  }
  return { player, realised, realisedPayoffs, reactiveModel, alternatives };
}
