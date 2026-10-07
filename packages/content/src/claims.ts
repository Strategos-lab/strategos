import { paretoAnalysis } from '@strategos/engine';
import { actionIds, bestResponseSet, payoffOf, playerIndex, uniqueBestResponse } from './game.ts';
import { bestToBelief, type Instance } from './instance.ts';
import type { Claim } from './types.ts';

const key = (p: 0 | 1) => (p === 0 ? 'A' : 'B') as 'A' | 'B';
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

function dependsOnOther(inst: Instance, p: 0 | 1): boolean {
  const s = inst.structure;
  const own = actionIds(s, p);
  const oth = actionIds(s, (1 - p) as 0 | 1);
  return own.some((a) => {
    const vals = oth.map((o) => payoffOf(s, inst.params, p, p === 0 ? [a, o] : [o, a]));
    return new Set(vals).size > 1;
  });
}

/** Evaluate a claim on an instance with the engine. */
export function evaluateClaim(c: Claim, inst: Instance): boolean {
  const s = inst.structure;
  const idx = (w: 'you' | 'them') => playerIndex(inst.seat, w);
  switch (c.t) {
    case 'br':
      return uniqueBestResponse(s, inst.game, idx(c.who), c.against) === c.action;
    case 'brToBelief': {
      const b = bestToBelief(inst);
      return b.length === 1 && b[0] === c.action;
    }
    case 'beliefTie':
      return bestToBelief(inst).length > 1;
    case 'brMap':
      return Object.entries(c.map).every(([against, a]) => uniqueBestResponse(s, inst.game, idx(c.who), against) === a);
    case 'strictDom':
      return inst.facts.strictlyDominant[key(idx(c.who))] === c.action;
    case 'hasStrictDom':
      return inst.facts.strictlyDominant[key(idx(c.who))] !== null;
    case 'noStrictDom':
      return inst.facts.strictlyDominant[key(idx(c.who))] === null;
    case 'weakDomOnly':
      return inst.facts.weaklyDominantOnly[key(idx(c.who))] === c.action;
    case 'strictlyDominated':
      return inst.facts.strictlyDominated[key(idx(c.who))].includes(c.action);
    case 'brDepends':
      return inst.facts.bestResponseDependsOnOpponent[key(idx(c.who))];
    case 'brIndependent':
      return !inst.facts.bestResponseDependsOnOpponent[key(idx(c.who))];
    case 'iesds':
      return inst.facts.iesdsSolution !== null && inst.facts.iesdsSolution.join('|') === c.profile.join('|');
    case 'iesdsUnsolved':
      return inst.facts.iesdsSolution === null;
    case 'dependsOnOther':
      return dependsOnOther(inst, idx(c.who));
    case 'notDependsOnOther':
      return !dependsOnOther(inst, idx(c.who));
    case 'playerSet':
      return sameSet(c.actors, ['you', 'them']);
    case 'actionSet':
      return sameSet(c.actions, actionIds(s, idx(c.who)));
    case 'topOutcome': {
      const p = idx(c.who);
      let best = -Infinity;
      let arg: string[] = [];
      for (const a of s.actions.A)
        for (const b of s.actions.B) {
          const v = payoffOf(s, inst.params, p, [a, b]);
          if (v > best) [best, arg] = [v, [`${a}|${b}`]];
          else if (v === best) arg.push(`${a}|${b}`);
        }
      return arg.length === 1 && arg[0] === `${c.profile[0]}|${c.profile[1]}`;
    }
    case 'brTie': {
      const set = bestResponseSet(s, inst.game, idx(c.who), c.against);
      return set.length > 1 && sameSet(set, c.actions);
    }
    case 'indifferent': {
      const p = idx(c.who);
      return payoffOf(s, inst.params, p, c.profiles[0]) === payoffOf(s, inst.params, p, c.profiles[1]);
    }
    case 'prefers': {
      const p = idx(c.who);
      return payoffOf(s, inst.params, p, c.better) > payoffOf(s, inst.params, p, c.worse);
    }
    case 'noneDominated':
      return inst.facts.strictlyDominated.A.length === 0 && inst.facts.strictlyDominated.B.length === 0;
    case 'domOutcomeImprovable':
    case 'domOutcomeUnimprovable': {
      const { A, B } = inst.facts.strictlyDominant;
      if (A === null || B === null) return false;
      const cell = [s.actions.A.indexOf(A), s.actions.B.indexOf(B)];
      const o = paretoAnalysis(inst.game).outcomes.find((x) => x.profile[0] === cell[0] && x.profile[1] === cell[1])!;
      if (c.t === 'domOutcomeUnimprovable') return o.efficient;
      const than = [s.actions.A.indexOf(c.than[0]), s.actions.B.indexOf(c.than[1])];
      const better = [0, 1].every((p) => payoffOf(s, inst.params, p as 0 | 1, c.than) > payoffOf(s, inst.params, p as 0 | 1, [A, B]));
      return better && o.dominatedBy.some((d) => d[0] === than[0] && d[1] === than[1]);
    }
    case 'simultaneous':
      return s.sequence === 'simultaneous';
    case 'firstMover':
      return s.sequence !== 'simultaneous' && idx(c.who) === 0;
    case 'observes':
      return s.sequence === 'sequential_observed' && idx(c.who) === 1;
    case 'notObserves':
      return !(s.sequence === 'sequential_observed' && idx(c.who) === 1);
    case 'never':
      return false;
  }
}
