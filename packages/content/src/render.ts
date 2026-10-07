import { dominance, iesds } from '@strategos/engine';
import { actionIds, payoffOf, playerIndex, uniqueBestResponse } from './game.ts';
import { bestToBelief, expectedUnderBelief, type Instance } from './instance.ts';
import type { SlotExpr, Who } from './types.ts';

/**
 * Template slots (all numbers come from the engine, never from copy):
 *   {them} other role's short name · {np:N} non-player N · {act:id} action label
 *   {pay:who:aId:bId} payoff · {br:who:against} unique best-response label
 *   {dom:who} strictly dominant action label · {belief:id} belief as a percentage
 *   {ev:id} expected payoff of an own action under the belief · {bbr} best response to the belief
 *   {story:situation|timing|information|incentive} quoted skin text (evidence in narrative items)
 *   {f:name} item fact · {slot:id} fill-in blank
 * A capitalised token ({Them}, {Np:0}, {Story:timing}) capitalises the first letter of its value.
 */
export const SLOT_RE = /\{([A-Za-z]+)(?::([^{}]*))?\}/g;

export class RenderError extends Error {}

const isWho = (x: string | undefined): x is Who => x === 'you' || x === 'them';

function percent(r: string): string {
  const [n, d = '1'] = r.split('/');
  const v = (Number(n) * 100) / Number(d);
  if (!Number.isInteger(v)) throw new RenderError(`belief ${r} is not a whole percentage`);
  return `${v}%`;
}

/** Exact rational as a terminating decimal ("14/5" → "2.8"); non-terminating values are refused. */
export function decimal(r: string): string {
  const [ns, ds = '1'] = r.split('/');
  let n = BigInt(ns!);
  let d = BigInt(ds);
  const neg = n < 0n;
  if (neg) n = -n;
  let k = 0;
  let dd = d;
  while (dd % 2n === 0n) { dd /= 2n; k++; }
  while (dd % 5n === 0n) { dd /= 5n; k++; }
  if (dd !== 1n) throw new RenderError(`${r} has no exact decimal form`);
  const scale = 10n ** BigInt(k);
  const v = (n * scale) / d;
  const int = v / scale;
  const frac = (v % scale).toString().padStart(k, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}

export function slotValue(e: SlotExpr, inst: Instance): string {
  const label = (id: string) => {
    const l = inst.skin.actionLabels[id];
    if (l === undefined) throw new RenderError(`${inst.skin.id}: no label for action "${id}"`);
    return l;
  };
  switch (e.k) {
    case 'payoff':
      return String(payoffOf(inst.structure, inst.params, playerIndex(inst.seat, e.who), e.profile));
    case 'action':
      return label(e.id);
    case 'brLabel': {
      const br = uniqueBestResponse(inst.structure, inst.game, playerIndex(inst.seat, e.who), e.against);
      if (br === null) throw new RenderError(`no unique best response for ${e.who} against ${e.against}`);
      return label(br);
    }
    case 'domLabel': {
      const p = playerIndex(inst.seat, e.who);
      const d = inst.facts.strictlyDominant[p === 0 ? 'A' : 'B'];
      if (d === null) throw new RenderError(`no strictly dominant action for ${e.who}`);
      return label(d);
    }
    case 'expected':
      return decimal(expectedUnderBelief(inst, e.action));
    case 'beliefBr': {
      const b = bestToBelief(inst);
      if (b.length !== 1) throw new RenderError('no unique best response to the belief');
      return label(b[0]!);
    }
    case 'ifDom': {
      const p = playerIndex(inst.seat, e.who);
      const has = inst.facts.strictlyDominant[p === 0 ? 'A' : 'B'] !== null;
      return render(has ? e.yes : e.no, inst);
    }
    case 'iesdsSteps':
    case 'iesdsLeft': {
      const el = iesds(inst.game);
      const learner = playerIndex(inst.seat, 'you');
      const tag = (p: 0 | 1, i: number) => `${p === learner ? 'your' : `${inst.skin.roles.other.short}’s`} ${label(actionIds(inst.structure, p)[i]!)}`;
      if (e.k === 'iesdsSteps') {
        if (el.steps.length === 0) throw new RenderError('nothing is eliminated');
        const rounds = [...new Set(el.steps.map((x) => x.round))];
        return rounds.map((r) => el.steps.filter((x) => x.round === r).map((x) => tag(x.player, x.action)).join(' and ')).join(', then ');
      }
      const side = (p: 0 | 1) => el.surviving[p].map((i) => tag(p, i)).join(' or ');
      return `${side(learner)}, with ${side((1 - learner) as 0 | 1)}`;
    }
    case 'weak': {
      const p = playerIndex(inst.seat, e.who);
      const own = actionIds(inst.structure, p);
      const opp = actionIds(inst.structure, (1 - p) as 0 | 1);
      const d = dominance(inst.game, p);
      if (own.length !== 2 || opp.length !== 2 || d.weaklyDominantAction === null || d.strictlyDominantAction !== null) throw new RenderError(`no weak-only dominance for ${e.who} in a 2×2`);
      const dom = own[d.weaklyDominantAction]!;
      const other = own[1 - d.weaklyDominantAction]!;
      const prof = (mine: string, o: string): [string, string] => (p === 0 ? [mine, o] : [o, mine]);
      const v = (mine: string, o: string) => payoffOf(inst.structure, inst.params, p, prof(mine, o));
      const tie = opp.find((o) => v(dom, o) === v(other, o))!;
      const win = opp.find((o) => v(dom, o) > v(other, o))!;
      switch (e.part) {
        case 'dom': return label(dom);
        case 'other': return label(other);
        case 'tie': return label(tie);
        case 'win': return label(win);
        case 'tiePay': return String(v(dom, tie));
        case 'winPay': return String(v(dom, win));
        default: return String(v(other, win));
      }
    }
    case 'belief': {
      const b = inst.variation.belief?.[e.action];
      if (b === undefined) throw new RenderError(`no belief for "${e.action}"`);
      return percent(b);
    }
  }
}

/** Parse a token's argument into a slot expression (shared by templates and facts). */
function tokenToExpr(kind: string, arg: string | undefined): SlotExpr | null {
  const a = (arg ?? '').split(':');
  switch (kind) {
    case 'act':
      return { k: 'action', who: 'you', id: a[0]! };
    case 'pay':
      if (!isWho(a[0]) || a.length !== 3) throw new RenderError(`bad {pay:${arg}}`);
      return { k: 'payoff', who: a[0], profile: [a[1]!, a[2]!] };
    case 'br':
      if (!isWho(a[0])) throw new RenderError(`bad {br:${arg}}`);
      return { k: 'brLabel', who: a[0], against: a[1]! };
    case 'dom':
      if (!isWho(a[0])) throw new RenderError(`bad {dom:${arg}}`);
      return { k: 'domLabel', who: a[0] };
    case 'belief':
      return { k: 'belief', action: a[0]! };
    case 'ev':
      return { k: 'expected', action: a[0]! };
    case 'bbr':
      return { k: 'beliefBr' };
    default:
      return null;
  }
}

export interface RenderOptions {
  facts?: Record<string, SlotExpr>;
  blanks?: boolean;
}

export function storyText(inst: Instance, which: string): string {
  const k = inst.skin;
  switch (which) {
    case 'situation': return k.situation;
    case 'timing': return k.timing;
    case 'information': return k.information;
    case 'incentive': {
      const key = inst.seat === 'A' ? inst.structure.id : `${inst.structure.id}@B`;
      const t = k.incentives[key];
      if (!t) throw new RenderError(`${k.id}: no incentives for ${key}`);
      return t;
    }
    default:
      throw new RenderError(`unknown story field "${which}"`);
  }
}

export function render(template: string, inst: Instance, opts: RenderOptions = {}): string {
  return template.replace(SLOT_RE, (_m, raw: string, arg?: string) => {
    const kind = raw.toLowerCase();
    const v = resolve(kind, arg, inst, opts);
    return raw[0] !== kind[0] ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  });
}

function resolve(kind: string, arg: string | undefined, inst: Instance, opts: RenderOptions): string {
  {
    if (kind === 'story') return storyText(inst, arg ?? '');
    if (kind === 'them') return inst.skin.roles.other.short;
    if (kind === 'np') {
      const np = inst.skin.nonPlayers?.[Number(arg)];
      if (!np) throw new RenderError(`${inst.skin.id}: no non-player ${arg}`);
      return np.short;
    }
    if (kind === 'f') {
      const e = opts.facts?.[arg ?? ''];
      if (!e) throw new RenderError(`unknown fact {f:${arg}}`);
      return slotValue(e, inst);
    }
    if (kind === 'slot') {
      if (opts.blanks === false) throw new RenderError('blank not allowed here');
      return '___';
    }
    const e = tokenToExpr(kind, arg);
    if (!e) throw new RenderError(`unknown slot {${kind}${arg ? `:${arg}` : ''}}`);
    return slotValue(e, inst);
  }
}

export function hasSlot(text: string): boolean {
  return new RegExp(SLOT_RE.source).test(text);
}

/** Slots that carry engine evidence (numbers or engine-derived labels). */
export function hasEvidenceSlot(text: string): boolean {
  return /\{(pay|br|dom|belief|ev|bbr|f|story)(:[^{}]*)?\}/i.test(text);
}
