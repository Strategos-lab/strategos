import { evaluateClaim } from './claims.ts';
import { buildGame, computeFacts, factsDiff, matrices, ordinalForms, ordinalKey, paramCombos, payoffOf, sequentialIssues } from './game.ts';
import { checkGating, findCycle, lessonOrder, type GatedText } from './gating.ts';
import { allInstances, makeLookup, type Instance, type Lookup } from './instance.ts';
import { leadClause, lintField, MAX_LENGTH, similarity, VERDICT_OPENER, type FieldKind, type LintIssue } from './lint.ts';
import { hasSlot, render, slotValue } from './render.ts';
import { keysFor } from './feedback/diagnose.ts';
import { ROOMMATE_SLICE } from './slice.ts';
import { DOMAINS, STEPS, type Claim, type ContentBundle, type HeldOutBundle, type Item, type Skin, type Structure } from './types.ts';

export interface Issue {
  rule: string;
  where: string;
  message: string;
}

/** Near-duplicate threshold for story text between held-out/transfer and practice skins. */
export const SIMILARITY_MAX = 0.5;
/** Distractor length window relative to the correct option (plan §7.6.3). */
export const LENGTH_TOLERANCE = 0.3;

const skinText = (k: Skin) => [k.situation, ...Object.values(k.incentives)].join(' ');

function dupIds(list: { id: string }[], what: string, issues: Issue[]) {
  const seen = new Set<string>();
  for (const x of list) {
    if (!x || typeof x.id !== 'string' || x.id === '') issues.push({ rule: 'required', where: what, message: 'missing id' });
    else if (seen.has(x.id)) issues.push({ rule: 'unique-id', where: `${what}:${x.id}`, message: 'duplicate id' });
    else seen.add(x.id);
  }
}

function req(obj: Record<string, unknown>, fields: string[], where: string, issues: Issue[]) {
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0 && f !== 'constraints')) {
      issues.push({ rule: 'required', where, message: `missing required field "${f}"` });
    }
  }
}

function lintAll(fields: [string, FieldKind, string][], issues: Issue[], length = true) {
  for (const [where, kind, text] of fields) {
    for (const l of lintField(where, kind, text, { length }) as LintIssue[]) issues.push({ rule: 'lint', where: l.where, message: l.message });
  }
}

export function validateStructures(structures: Structure[], issues: Issue[]) {
  for (const s of structures) {
    const w = `structure:${s.id}`;
    req(s as unknown as Record<string, unknown>, ['id', 'version', 'module', 'sequence', 'presentation', 'scale', 'actions', 'payoffs', 'params', 'facts'], w, issues);
    if (!['simultaneous', 'sequential_observed', 'sequential_unobserved'].includes(s.sequence)) issues.push({ rule: 'schema', where: w, message: `unknown sequence "${String(s.sequence)}"` });
    if (!s.actions || !s.payoffs) continue;
    for (const a of s.actions.A) for (const b of s.actions.B) {
      if (!s.payoffs[`${a}|${b}`]) issues.push({ rule: 'structure', where: w, message: `missing payoff cell ${a}|${b}` });
    }
    let combos: Record<string, number>[] = [];
    try {
      combos = paramCombos(s);
    } catch (e) {
      issues.push({ rule: 'structure', where: w, message: String((e as Error).message) });
      continue;
    }
    if (combos.length === 0) issues.push({ rule: 'structure', where: w, message: 'no parameter combination satisfies the constraints' });
    for (const c of combos) {
      try {
        const diff = factsDiff(s.facts, computeFacts(s, buildGame(s, c)));
        for (const d of diff) issues.push({ rule: 'engine-facts', where: `${w} ${JSON.stringify(c)}`, message: d });
        for (const d of sequentialIssues(s, c)) issues.push({ rule: 'sequential', where: `${w} ${JSON.stringify(c)}`, message: d });
      } catch (e) {
        issues.push({ rule: 'structure', where: w, message: String((e as Error).message) });
      }
    }
  }
}

function payoffSignature(s: Structure, params: Record<string, number>): string {
  return s.actions.A.map((a) => s.actions.B.map((b) => `${payoffOf(s, params, 0, [a, b])},${payoffOf(s, params, 1, [a, b])}`).join(';')).join('/');
}


export function validateSkins(skins: Skin[], structures: Structure[], issues: Issue[], heldOut: boolean) {
  const byId = new Map(structures.map((s) => [s.id, s]));
  for (const k of skins) {
    const w = `skin:${k.id}`;
    req(k as unknown as Record<string, unknown>, ['id', 'version', 'domain', 'title', 'structures', 'roles', 'seats', 'actionLabels', 'situation', 'incentives', 'timing', 'information', 'matrixLabel'], w, issues);
    if (!DOMAINS.includes(k.domain)) issues.push({ rule: 'domain', where: w, message: `domain "${k.domain}" is not in the allowed list` });
    if (!!k.heldOut !== heldOut) issues.push({ rule: 'held-out', where: w, message: heldOut ? 'held-out skin must set heldOut: true' : 'practice skin marked heldOut' });
    const fields: [string, FieldKind, string][] = [
      [`${w}.title`, 'title', k.title],
      [`${w}.situation`, 'situation', k.situation],
      [`${w}.timing`, 'glance', k.timing],
      [`${w}.information`, 'glance', k.information],
      [`${w}.matrixLabel`, 'matrixLabel', k.matrixLabel],
    ];
    for (const [id, l] of Object.entries(k.actionLabels ?? {})) fields.push([`${w}.actionLabels.${id}`, 'actionLabel', l]);
    for (const [id, t] of Object.entries(k.incentives ?? {})) fields.push([`${w}.incentives.${id}`, 'glance', t]);
    for (const [id, t] of Object.entries(k.outcomes ?? {})) fields.push([`${w}.outcomes.${id}`, 'outcome', t]);
    lintAll(fields, issues);
    for (const sid of k.structures ?? []) {
      const s = byId.get(sid);
      if (!s) {
        issues.push({ rule: 'reference', where: w, message: `unknown structure "${sid}"` });
        continue;
      }
      for (const a of [...s.actions.A, ...s.actions.B]) {
        if (!k.actionLabels?.[a]) issues.push({ rule: 'reference', where: w, message: `no label for action "${a}" of ${sid}` });
      }
      for (const seat of k.seats ?? []) {
        const key = seat === 'A' ? sid : `${sid}@B`;
        if (!k.incentives?.[key]) issues.push({ rule: 'reference', where: w, message: `no incentives for "${key}"` });
      }
      if (k.outcomes) {
        for (const a of s.actions.A) for (const b of s.actions.B) {
          if (!k.outcomes[`${a}|${b}`]) issues.push({ rule: 'reference', where: w, message: `no outcome text for ${a}|${b}` });
        }
      }
    }
  }
}

/** Learner-facing texts of one item instance for gating, lint and length checks. */
function itemTexts(item: Item, inst: Instance): { prompt: string; options: string[][] } {
  return {
    prompt: render(item.prompt, inst, { facts: item.facts }),
    options: (item.optionSets ?? []).map((set) => set.map((o) => render(o.text, inst, { facts: item.facts }))),
  };
}

export function validateItems(items: Item[], b: Pick<ContentBundle, 'curriculum' | 'feedback' | 'rubrics' | 'errorCodes'>, look: Lookup, issues: Issue[], heldOut: boolean) {
  const codes = new Set(b.errorCodes.map((c) => c.code));
  const lessons = new Map(b.curriculum.modules.flatMap((m) => m.lessons).map((l) => [l.id, l]));
  for (const item of items) {
    const w = `item:${item.id}`;
    req(item as unknown as Record<string, unknown>, ['id', 'version', 'lesson', 'step', 'role', 'concept', 'type', 'structure', 'skins', 'variations', 'exposure', 'novelty', 'seat', 'prompt'], w, issues);
    if (!lessons.has(item.lesson)) issues.push({ rule: 'reference', where: w, message: `unknown lesson "${item.lesson}"` });
    else if (!heldOut && !lessons.get(item.lesson)!.items.includes(item.id)) issues.push({ rule: 'reference', where: w, message: `lesson ${item.lesson} does not list this item` });
    if (!STEPS.includes(item.step)) issues.push({ rule: 'schema', where: w, message: `unknown step "${item.step}"` });
    if (heldOut !== (item.role === 'held_out')) issues.push({ rule: 'held-out', where: w, message: heldOut ? 'held-out item must have role held_out' : 'role held_out outside the held-out set' });
    if ((item.role === 'transfer' || item.role === 'held_out') && item.exposure !== 'transfer_hidden') {
      issues.push({ rule: 'gating', where: w, message: 'transfer and held-out items must be transfer_hidden' });
    }
    const s = look.structure(item.structure);
    if (!s) {
      issues.push({ rule: 'reference', where: w, message: `unknown structure "${item.structure}"` });
      continue;
    }
    let bad = false;
    for (const k of item.skins) {
      const skin = look.skin(k);
      if (!skin) { issues.push({ rule: 'reference', where: w, message: `unknown skin "${k}"` }); bad = true; continue; }
      if (!skin.structures.includes(s.id)) { issues.push({ rule: 'reference', where: w, message: `skin ${k} does not map structure ${s.id}` }); bad = true; }
      if (!skin.seats.includes(item.seat)) { issues.push({ rule: 'reference', where: w, message: `skin ${k} has no story for seat ${item.seat}` }); bad = true; }
    }
    for (const v of item.variations) {
      const vv = look.variation(v);
      if (!vv) { issues.push({ rule: 'reference', where: w, message: `unknown variation "${v}"` }); bad = true; continue; }
      if (vv.structure !== s.id) { issues.push({ rule: 'reference', where: w, message: `variation ${v} belongs to ${vv.structure}` }); bad = true; }
      if (vv.seat !== item.seat) { issues.push({ rule: 'reference', where: w, message: `variation ${v} seat ${vv.seat} ≠ item seat ${item.seat}` }); bad = true; }
    }
    if (bad) continue;
    const usedCodes: string[] = [];
    if (item.type === 'reason_choice') {
      if (!item.optionSets || item.optionSets.length < 2) issues.push({ rule: 'distractor', where: w, message: 'needs at least two parallel option sets' });
      for (const set of item.optionSets ?? []) {
        if (set.length < 3) issues.push({ rule: 'distractor', where: w, message: 'option set needs at least three options' });
      }
    } else if (item.type === 'fill_in') {
      if (!item.slots?.length) issues.push({ rule: 'required', where: w, message: 'fill_in needs slots' });
      for (const sl of item.slots ?? []) {
        if (!item.prompt.includes(`{slot:${sl.id}}`)) issues.push({ rule: 'reference', where: w, message: `prompt has no blank {slot:${sl.id}}` });
        for (const kw of sl.knownWrong) usedCodes.push(kw.code);
      }
      usedCodes.push('UNMATCHED');
    } else if (item.type === 'own_words') {
      if (!item.rubric || !b.rubrics.some((r) => r.id === item.rubric)) issues.push({ rule: 'reference', where: w, message: `unknown rubric "${item.rubric}"` });
    } else issues.push({ rule: 'schema', where: w, message: `unknown item type "${item.type as string}"` });
    lintAll([[`${w}.prompt`, 'prompt', item.prompt], ...(item.optionSets ?? []).flat().map((o, i) => [`${w}.option${i}`, 'option', o.text] as [string, FieldKind, string])], issues, false);

    let insts: Instance[] = [];
    try {
      insts = allInstances(item, look);
    } catch (e) {
      issues.push({ rule: 'reference', where: w, message: (e as Error).message });
      continue;
    }
    for (const inst of insts) {
      const wi = `${w}[${inst.skin.id}/${inst.variation.id}]`;
      let t: ReturnType<typeof itemTexts>;
      try {
        t = itemTexts(item, inst);
        for (const e of Object.values(item.facts ?? {})) slotValue(e, inst);
      } catch (e) {
        issues.push({ rule: 'render', where: wi, message: (e as Error).message });
        continue;
      }
      for (const o of t.options.flat()) if (o.length > MAX_LENGTH.option) issues.push({ rule: 'lint', where: wi, message: `rendered option too long (${o.length})` });
      if (t.prompt.length > 200) issues.push({ rule: 'lint', where: wi, message: 'rendered prompt too long' });
      (item.optionSets ?? []).forEach((set, si) => {
        const truth = set.map((o) => evaluateClaim(o.claim, inst));
        set.forEach((o, oi) => { if (!truth[oi]) usedCodes.push(o.code); });
        const n = truth.filter(Boolean).length;
        if (n !== 1) issues.push({ rule: 'distractor-engine', where: `${wi} set ${si}`, message: `exactly one option must be correct (engine finds ${n})` });
        const ci = truth.indexOf(true);
        if (ci >= 0) {
          const len = t.options[si]![ci]!.length;
          t.options[si]!.forEach((o, oi) => {
            if (oi !== ci && Math.abs(o.length - len) > LENGTH_TOLERANCE * len) {
              issues.push({ rule: 'distractor-form', where: `${wi} set ${si} option ${oi}`, message: `length ${o.length} outside ±30% of the correct option (${len})` });
            }
          });
        }
        const lower = new Set(t.options[si]!.map((o) => o.toLowerCase()));
        if (lower.size !== set.length) issues.push({ rule: 'distractor-form', where: `${wi} set ${si}`, message: 'duplicate options' });
      });
      for (const sl of item.slots ?? []) {
        const ans = slotValue(sl.answer, inst);
        for (const kw of sl.knownWrong) {
          if (slotValue(kw.value, inst) === ans) {
            issues.push({ rule: 'distractor-engine', where: `${wi} slot ${sl.id}`, message: `known-wrong source (${kw.code}) equals the correct value ${ans}: diagnosis would be ambiguous` });
          }
        }
      }
      // Every feedback phrasing used by this item must render here, evidence first.
      for (const key of keysFor(b.feedback, item)) {
        for (const ph of [...key.phrasings, ...(key.term ? [key.term] : [])]) {
          try {
            const out = render(ph, inst, { facts: item.facts, blanks: false });
            if (out.length > MAX_LENGTH.feedback) issues.push({ rule: 'lint', where: `${wi} feedback ${key.code}`, message: `rendered feedback too long (${out.length} > ${MAX_LENGTH.feedback})` });
          } catch (e) {
            issues.push({ rule: 'render', where: `${wi} feedback ${key.code}`, message: (e as Error).message });
          }
        }
      }
    }
    for (const c of new Set(usedCodes)) if (!codes.has(c)) issues.push({ rule: 'reference', where: w, message: `undefined error code "${c}"` });
    // Feedback coverage (plan §7.6.5): CORRECT plus every code a wrong answer can produce.
    if (item.type !== 'own_words') {
      for (const c of ['CORRECT', ...new Set(usedCodes)]) {
        const key = keysFor(b.feedback, item).find((k) => k.code === c);
        if (!key) issues.push({ rule: 'feedback-coverage', where: w, message: `no feedback for (${item.concept}, ${item.type}, ${c})` });
        else if (key.phrasings.length < 2) issues.push({ rule: 'feedback-coverage', where: w, message: `feedback (${item.concept}, ${item.type}, ${c}) needs ≥ 2 phrasings` });
      }
    }
  }
}

export function validateFeedbackLibrary(b: ContentBundle, issues: Issue[]) {
  const seen = new Set<string>();
  for (const k of b.feedback) {
    const id = `${k.concept}/${k.type}/${k.code}${k.items ? `@${k.items.join(',')}` : ''}`;
    for (const i of k.items ?? []) if (!b.items.some((x) => x.id === i)) issues.push({ rule: 'reference', where: `feedback:${id}`, message: `unknown item "${i}"` });
    const w = `feedback:${id}`;
    if (seen.has(id)) issues.push({ rule: 'unique-id', where: w, message: 'duplicate feedback key' });
    seen.add(id);
    if (!b.concepts.some((c) => c.id === k.concept)) issues.push({ rule: 'reference', where: w, message: 'unknown concept' });
    if (k.code !== 'CORRECT' && !b.errorCodes.some((c) => c.code === k.code)) issues.push({ rule: 'reference', where: w, message: 'unknown error code' });
    if (k.phrasings.length < 2 || k.phrasings.length > 3) issues.push({ rule: 'feedback-coverage', where: w, message: 'needs 2–3 phrasings' });
    for (const [i, p] of k.phrasings.entries()) {
      lintAll([[`${w}#${i}`, 'feedback', p]], issues, false);
      const first = leadClause(p);
      if (VERDICT_OPENER.test(p.trim())) issues.push({ rule: 'evidence-first', where: `${w}#${i}`, message: 'starts with a verdict; status is shown separately, the text starts with evidence' });
      if (!hasSlot(first)) issues.push({ rule: 'evidence-first', where: `${w}#${i}`, message: 'opening clause carries no engine evidence slot' });
    }
    if (k.term) lintAll([[`${w}.term`, 'feedback', k.term]], issues);
  }
}

export function validateCurriculum(b: ContentBundle, issues: Issue[]) {
  const conceptIds = new Set(b.concepts.map((c) => c.id));
  const order = lessonOrder(b.curriculum);
  dupIds(b.curriculum.modules, 'module', issues);
  dupIds(b.curriculum.modules.flatMap((m) => m.lessons), 'lesson', issues);
  const cyc = findCycle(b.concepts);
  if (cyc) issues.push({ rule: 'concept-graph', where: 'concepts', message: `prerequisite cycle: ${cyc.join(' → ')}` });
  for (const c of b.concepts) {
    const w = `concept:${c.id}`;
    for (const p of c.prerequisites) if (!conceptIds.has(p)) issues.push({ rule: 'reference', where: w, message: `unknown prerequisite "${p}"` });
    if (!STEPS.includes(c.revealStep)) issues.push({ rule: 'schema', where: w, message: `unknown reveal step "${c.revealStep}"` });
    if (c.introducedIn === null) continue;
    if (!order.includes(c.introducedIn)) { issues.push({ rule: 'reference', where: w, message: `unknown lesson "${c.introducedIn}"` }); continue; }
    const lesson = b.curriculum.modules.flatMap((m) => m.lessons).find((l) => l.id === c.introducedIn)!;
    if (!lesson.introduces.includes(c.id)) issues.push({ rule: 'reference', where: w, message: `lesson ${lesson.id} does not list it in introduces` });
    for (const p of c.prerequisites) {
      const pc = b.concepts.find((x) => x.id === p);
      if (pc && (pc.introducedIn === null || order.indexOf(pc.introducedIn) > order.indexOf(c.introducedIn))) {
        issues.push({ rule: 'concept-graph', where: w, message: `prerequisite ${p} is introduced after ${c.id}` });
      }
    }
  }
  for (const m of b.curriculum.modules) {
    for (const l of m.lessons) {
      const w = `lesson:${l.id}`;
      for (const c of [...l.introduces, ...l.requires]) if (!conceptIds.has(c)) issues.push({ rule: 'reference', where: w, message: `unknown concept "${c}"` });
      for (const c of l.introduces) {
        if (b.concepts.find((x) => x.id === c)?.introducedIn !== l.id) issues.push({ rule: 'reference', where: w, message: `introduces ${c} but the concept names another lesson` });
      }
      for (const c of l.requires) {
        const cc = b.concepts.find((x) => x.id === c);
        if (cc && (cc.introducedIn === null || order.indexOf(cc.introducedIn) >= order.indexOf(l.id))) issues.push({ rule: 'prerequisite', where: w, message: `requires ${c}, which is not introduced earlier` });
      }
      for (const i of l.items) if (!b.items.some((x) => x.id === i)) issues.push({ rule: 'reference', where: w, message: `unknown item "${i}"` });
      lintAll([[`${w}.workingTitle`, 'title', l.workingTitle]], issues);
      for (const [i, p] of (l.reveal?.body ?? []).entries()) lintAll([[`${w}.reveal#${i}`, 'reveal', p]], issues);
    }
  }
  for (const item of b.items) {
    const c = b.concepts.find((x) => x.id === item.concept);
    if (!c) { issues.push({ rule: 'reference', where: `item:${item.id}`, message: `unknown concept "${item.concept}"` }); continue; }
    if (c.introducedIn === null || order.indexOf(c.introducedIn) > order.indexOf(item.lesson)) {
      issues.push({ rule: 'prerequisite', where: `item:${item.id}`, message: `concept ${c.id} is not introduced by lesson ${item.lesson}` });
    }
  }
  for (const r of b.rubrics) {
    const w = `rubric:${r.id}`;
    if (r.criteria.length < 3 || r.criteria.length > 5) issues.push({ rule: 'rubric', where: w, message: 'needs 3–5 criteria' });
    for (const c of r.criteria) if (!c.text || !c.meets || !c.misses) issues.push({ rule: 'rubric', where: w, message: `criterion ${c.id} needs text, meets and misses examples` });
    if (r.selfAssessmentWeight !== 0) issues.push({ rule: 'rubric', where: w, message: 'self-assessment must never raise Understanding (weight 0)' });
    if (r.corroborationRequired !== true) issues.push({ rule: 'rubric', where: w, message: 'corroborationRequired must be true' });
    lintAll([[`${w}.prompt`, 'prompt', r.prompt], ...r.criteria.flatMap((c) => [[`${w}.${c.id}`, 'rubric', c.text], [`${w}.${c.id}.meets`, 'rubric', c.meets], [`${w}.${c.id}.misses`, 'rubric', c.misses]] as [string, FieldKind, string][])], issues);
  }
}

/** Learner-facing text per (lesson, step) for terminology gating. */
export function gatedTexts(b: ContentBundle, extra: GatedText[] = [], hb?: HeldOutBundle): GatedText[] {
  const out: GatedText[] = [...extra];
  const look = makeLookup({ structures: [...b.structures, ...(hb?.structures ?? [])], skins: [...b.skins, ...(hb?.skins ?? [])], variations: [...b.variations, ...(hb?.variations ?? [])] });
  for (const m of b.curriculum.modules) {
    const first = m.lessons[0]!.id;
    const last = m.lessons[m.lessons.length - 1]!.id;
    out.push({ lesson: first, step: 'title', text: m.workingTitle, where: `module:${m.id}.workingTitle` });
    out.push({ lesson: last, step: 'summary', text: m.formalTitle, where: `module:${m.id}.formalTitle` });
    for (const l of m.lessons) {
      out.push({ lesson: l.id, step: 'title', text: l.workingTitle, where: `lesson:${l.id}.workingTitle` });
      for (const [i, p] of (l.reveal?.body ?? []).entries()) out.push({ lesson: l.id, step: 'reveal', text: p, where: `lesson:${l.id}.reveal#${i}` });
    }
  }
  for (const item of [...b.items, ...(hb?.items ?? [])]) {
    const hide = item.exposure === 'transfer_hidden' ? item.concept : undefined;
    const assessment = item.role === 'transfer' || item.role === 'held_out' ? { assessment: true } : {};
    const pre = (text: string, where: string, claim = false) =>
      out.push({ lesson: item.lesson, step: item.step, text, where, ...(hide ? { hide } : {}), ...assessment, ...(claim ? { claim } : {}) });
    pre(item.prompt, `item:${item.id}.prompt`);
    for (const set of item.optionSets ?? []) for (const o of set) pre(o.text, `item:${item.id}.option`, true);
    for (const k of item.skins) {
      const skin = look.skin(k);
      if (!skin) continue;
      for (const t of [skin.title, skin.situation, skin.timing, skin.information, ...Object.values(skin.incentives), ...Object.values(skin.actionLabels)]) {
        out.push({ lesson: item.lesson, step: 'encounter', text: t, where: `skin:${k}`, ...(hide ? { hide } : {}), ...assessment });
      }
      out.push({ lesson: item.lesson, step: 'matrix', text: skin.matrixLabel, where: `skin:${k}.matrixLabel`, ...(hide ? { hide } : {}), ...assessment });
      for (const t of Object.values(skin.outcomes ?? {})) out.push({ lesson: item.lesson, step: 'outcome', text: t, where: `skin:${k}.outcomes` });
    }
    for (const key of keysFor(b.feedback, item)) {
      for (const p of [...key.phrasings, ...(key.term ? [key.term] : [])]) out.push({ lesson: item.lesson, step: 'feedback', text: p, where: `feedback:${key.concept}/${key.type}/${key.code} (via ${item.id})` });
    }
  }
  for (const r of b.rubrics) {
    const users = b.items.filter((i) => i.rubric === r.id);
    for (const u of users) out.push({ lesson: u.lesson, step: u.step, text: r.prompt, where: `rubric:${r.id}.prompt` });
  }
  return out;
}

/** Validate the practice bundle (and, when given, the held-out set's separation). */
export function validateContent(b: ContentBundle, opts: { extraTexts?: GatedText[]; heldOut?: HeldOutBundle; scenarioQuestions?: Record<string, string[]> } = {}): Issue[] {
  const issues: Issue[] = [];
  dupIds(b.concepts, 'concept', issues);
  dupIds(b.structures, 'structure', issues);
  dupIds(b.skins, 'skin', issues);
  dupIds(b.variations, 'variation', issues);
  dupIds(b.items, 'item', issues);
  dupIds(b.rubrics, 'rubric', issues);
  validateCurriculum(b, issues);
  validateStructures(b.structures, issues);
  for (const s of b.structures) if (s.heldOut) issues.push({ rule: 'held-out', where: `structure:${s.id}`, message: 'held-out structure in the practice bundle' });
  validateSkins(b.skins, b.structures, issues, false);
  validateVariations(b.variations, b.structures, issues, false);
  validateBeliefCoherence(b.variations, b.structures, issues);
  validateExclusiveWording(b.skins, b.structures, issues);
  validateMirrors(b.skins, issues);
  const look = makeLookup(b);
  validateItems(b.items, b, look, issues, false);
  validateFeedbackLibrary(b, issues);
  validateTransfer(b, issues);
  validateCodeScope(b, opts.heldOut, issues);
  validateScenarioItems(b, opts.scenarioQuestions ?? { [ROOMMATE_SLICE.id]: ROOMMATE_SLICE.questions.map((q) => String(q.id)) }, issues);
  for (const g of checkGating(gatedTexts(b, opts.extraTexts ?? [], opts.heldOut), b.concepts, b.curriculum)) issues.push({ rule: 'gating', ...g });
  if (opts.heldOut) validateHeldOut(b, opts.heldOut, issues);
  return issues;
}

export function validateVariations(vars: ContentBundle['variations'], structures: Structure[], issues: Issue[], heldOut: boolean) {
  const byId = new Map(structures.map((s) => [s.id, s]));
  for (const v of vars) {
    const w = `variation:${v.id}`;
    if (!!v.heldOut !== heldOut) issues.push({ rule: 'held-out', where: w, message: heldOut ? 'held-out variation must set heldOut: true' : 'practice variation marked heldOut' });
    const s = byId.get(v.structure);
    if (!s) { issues.push({ rule: 'reference', where: w, message: `unknown structure "${v.structure}"` }); continue; }
    const combos = paramCombos(s);
    const key = (p: Record<string, number>) => JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]));
    if (!combos.some((c) => key(c) === key(v.params))) issues.push({ rule: 'variation', where: w, message: `params ${JSON.stringify(v.params)} are not an allowed combination of ${s.id}` });
    if (v.purpose === 'change') {
      if (!v.facts || !v.changeReason) issues.push({ rule: 'variation', where: w, message: 'a structure-changing variation must declare facts and changeReason' });
    } else if (v.facts) issues.push({ rule: 'variation', where: w, message: 'a preserving variation must not override facts' });
    if (v.belief) {
      const opp = v.seat === 'A' ? s.actions.B : s.actions.A;
      const total = Object.entries(v.belief).reduce((acc, [id, p]) => {
        if (!opp.includes(id)) issues.push({ rule: 'variation', where: w, message: `belief over unknown action "${id}"` });
        const [n, d = '1'] = p.split('/');
        return acc + Number(n) / Number(d);
      }, 0);
      if (Math.abs(total - 1) > 1e-12) issues.push({ rule: 'variation', where: w, message: 'belief must sum to 1' });
    }
  }
}

/** Transfer items: new skins and not cosmetic swaps of practice stories (plan §3.4, §3.5). */
export function validateTransfer(b: ContentBundle, issues: Issue[]) {
  const look = makeLookup(b);
  const practice = b.items.filter((i) => i.role !== 'transfer');
  const practiceSkins = new Set(practice.flatMap((i) => i.skins));
  for (const t of b.items.filter((i) => i.role === 'transfer')) {
    const w = `item:${t.id}`;
    if (t.novelty === 'seen') issues.push({ rule: 'transfer', where: w, message: 'transfer item must be novel (new_skin, new_domain or new_structure)' });
    const sameConcept = practice.filter((i) => i.concept === t.concept);
    const seenDomains = new Set(sameConcept.flatMap((i) => i.skins).map((k) => look.skin(k)?.domain));
    const seenStructures = new Set(sameConcept.map((i) => i.structure));
    for (const k of t.skins) {
      const skin = look.skin(k);
      if (!skin) continue;
      if (practiceSkins.has(k)) issues.push({ rule: 'transfer', where: w, message: `skin ${k} is also used in practice` });
      if (t.novelty === 'new_domain' && seenDomains.has(skin.domain)) issues.push({ rule: 'transfer', where: w, message: `domain ${skin.domain} already practised for ${t.concept}` });
      for (const pk of practiceSkins) {
        const p = look.skin(pk);
        if (!p) continue;
        const sim = similarity(skinText(skin), skinText(p));
        if (sim >= SIMILARITY_MAX) issues.push({ rule: 'transfer', where: w, message: `story of ${k} is a near-duplicate of practice skin ${pk} (similarity ${sim.toFixed(2)})` });
      }
    }
    if (t.novelty === 'new_structure' && seenStructures.has(t.structure)) issues.push({ rule: 'transfer', where: w, message: `structure ${t.structure} already practised for ${t.concept}` });
  }
}

export function validateHeldOut(b: ContentBundle, h: HeldOutBundle, issues: Issue[]) {
  if (h.provisional !== true) issues.push({ rule: 'held-out', where: 'held-out', message: 'held-out set must be flagged provisional' });
  const all = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
  const pairs: [string, { id: string }[], { id: string }[]][] = [
    ['structure', b.structures, h.structures],
    ['skin', b.skins, h.skins],
    ['variation', b.variations, h.variations],
    ['item', b.items, h.items],
  ];
  for (const [what, prac, held] of pairs) {
    dupIds(held, `held-out ${what}`, issues);
    const p = all(prac);
    for (const x of held) if (p.has(x.id)) issues.push({ rule: 'held-out', where: `${what}:${x.id}`, message: 'id overlaps the practice set' });
  }
  const heldIds = new Set([...h.structures, ...h.skins, ...h.variations, ...h.items].map((x) => x.id));
  for (const i of b.items) {
    for (const ref of [i.structure, ...i.skins, ...i.variations]) {
      if (heldIds.has(ref)) issues.push({ rule: 'held-out', where: `item:${i.id}`, message: `practice item uses held-out ${ref}` });
    }
  }
  for (const s of h.structures) if (!s.heldOut) issues.push({ rule: 'held-out', where: `structure:${s.id}`, message: 'must set heldOut: true' });
  validateStructures(h.structures, issues);
  validateSkins(h.skins, h.structures, issues, true);
  validateVariations(h.variations, h.structures, issues, true);
  validateBeliefCoherence(h.variations, h.structures, issues);
  validateExclusiveWording(h.skins, h.structures, issues);
  validateMirrors(h.skins, issues);
  const look = makeLookup(h);
  for (const i of h.items) {
    if (!i.heldOutForm) issues.push({ rule: 'held-out', where: `item:${i.id}`, message: 'needs heldOutForm A/B/C' });
    const par = b.items.find((x) => x.id === i.parallelOf);
    if (!par) issues.push({ rule: 'held-out', where: `item:${i.id}`, message: `parallelOf "${i.parallelOf}" is not a practice item` });
    else if (par.concept !== i.concept || par.type !== i.type) issues.push({ rule: 'held-out', where: `item:${i.id}`, message: 'parallel form must test the same concept with the same item type' });
    if (i.structure && !h.structures.some((s) => s.id === i.structure)) issues.push({ rule: 'held-out', where: `item:${i.id}`, message: 'held-out items use held-out structures only' });
    for (const k of i.skins) if (!h.skins.some((s) => s.id === k)) issues.push({ rule: 'held-out', where: `item:${i.id}`, message: 'held-out items use held-out skins only' });
  }
  validateItems(h.items, b, look, issues, true);
  // No practised payoff structure, story or near-duplicate text (plan §3.4, §10.4.7).
  for (const x of heldOutIsomorphisms(b.structures, h.structures)) issues.push({ rule: 'held-out', where: `structure:${x.held}`, message: `strategic form ${JSON.stringify(x.heldParams)} is ordinally isomorphic to practised ${x.practice} ${JSON.stringify(x.practiceParams)} (${x.how})` });
  const texts = b.skins.map((k) => [k.id, skinText(k)] as const);
  const heldTexts: (readonly [string, string])[] = [];
  for (const k of h.skins) {
    const t = skinText(k);
    for (const [pid, pt] of [...texts, ...heldTexts]) {
      const sim = similarity(t, pt);
      if (sim >= SIMILARITY_MAX) issues.push({ rule: 'held-out', where: `skin:${k.id}`, message: `near-duplicate of ${pid} (similarity ${sim.toFixed(2)})` });
    }
    heldTexts.push([k.id, t]);
  }
  const forms = new Map<string, number>();
  for (const i of h.items) forms.set(i.heldOutForm ?? '?', (forms.get(i.heldOutForm ?? '?') ?? 0) + 1);
  const counts = ['A', 'B', 'C'].map((f) => forms.get(f) ?? 0);
  if (Math.max(...counts) - Math.min(...counts) > 1) issues.push({ rule: 'held-out', where: 'held-out', message: `parallel forms are unbalanced (${counts.join('/')})` });
  for (const x of heldOutAnswerShortcuts(h)) issues.push({ rule: 'held-out-answers', where: x.where, message: x.message });
}

/** The answer an option claim commits to, when it names actions or a profile (null for yes/no-style claims). */
export function claimAnswer(c: Claim): string | null {
  switch (c.t) {
    case 'br': case 'brToBelief': case 'strictDom': case 'weakDomOnly': case 'strictlyDominated':
      return c.action;
    case 'iesds':
      return c.profile.join('|');
    case 'topOutcome':
      return c.profile.join('|');
    case 'brTie':
      return [...c.actions].sort().join('+');
    default:
      return null;
  }
}

/**
 * Error codes reserved for one concept. WEAK_AS_STRICT is the M3 weak-vs-strict dominance error; a tie in a
 * best-response comparison is TREATING_TIE_AS_STRICT instead.
 */
export const CODE_SCOPE: Record<string, string[]> = { WEAK_AS_STRICT: ['weak_dominance'] };
export function validateCodeScope(b: ContentBundle, h: HeldOutBundle | undefined, issues: Issue[]) {
  for (const item of [...b.items, ...(h?.items ?? [])]) for (const set of item.optionSets ?? []) for (const o of set) {
    const ok = o.code ? CODE_SCOPE[o.code] : undefined;
    if (ok && !(ok.includes(item.concept) && item.lesson.startsWith('m3.'))) issues.push({ rule: 'code-scope', where: `item:${item.id}`, message: `${o.code} is reserved for ${ok.join(', ')} in Module 3 (item concept ${item.concept})` });
  }
  for (const k of b.feedback) {
    const ok = CODE_SCOPE[k.code];
    if (ok && !ok.includes(k.concept)) issues.push({ rule: 'code-scope', where: `feedback:${k.concept}/${k.code}`, message: `${k.code} is reserved for ${ok.join(', ')}` });
  }
}

export interface HeldAnswer { item: string; form: string; group: string; module: string; positions: number[]; answers: (string | null)[] }

/** Engine-evaluated correct option position and answer of every held-out item (all instances, all option sets). */
export function heldOutAnswers(h: HeldOutBundle): HeldAnswer[] {
  const look = makeLookup(h);
  const out: HeldAnswer[] = [];
  for (const item of h.items) {
    if (item.type !== 'reason_choice') continue;
    let insts: Instance[] = [];
    try { insts = allInstances(item, look); } catch { continue; }
    const positions: number[] = [];
    const answers: (string | null)[] = [];
    for (const inst of insts) for (const set of item.optionSets ?? []) {
      const ci = set.findIndex((o) => evaluateClaim(o.claim, inst));
      positions.push(ci);
      answers.push(ci >= 0 ? claimAnswer(set[ci]!.claim) : null);
    }
    out.push({ item: item.id, form: item.heldOutForm ?? '?', group: item.parallelOf ?? item.id, module: item.lesson.split('.')[0]!, positions, answers });
  }
  return out;
}

function mode<T>(xs: T[]): T | undefined {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0];
}
function maxShare<T>(xs: T[]): { v: T | undefined; n: number } {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  const [v, n] = [...c].sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
  return { v, n };
}

export interface HeldDistributionRow { item: string; family: string; form: string; module: string; seat: string; concept: string; domain: string; positions: number[]; answers: string[] }
/** Audit table: form × correct action × position × seat × concept × domain for every held-out item. */
export function heldOutDistribution(h: HeldOutBundle): HeldDistributionRow[] {
  return heldOutAnswers(h).map((r) => {
    const it = h.items.find((i) => i.id === r.item)!;
    const sk = h.skins.find((k) => k.id === it.skins[0]);
    return { item: r.item, family: r.group, form: r.form, module: r.module, seat: it.seat ?? 'A', concept: it.concept, domain: sk?.domain ?? '?',
      positions: [...new Set(r.positions)], answers: [...new Set(r.answers.map((a) => a ?? 'yes/no/none'))] };
  });
}

/**
 * Held-out answer shortcuts (plan §3.4): across the parallel forms of one practice item, the correct option
 * must not sit at the same position every time, and where the answer is an action (or profile) it must not be
 * the same one every time. Within a module, action answers must not all be the same action either.
 */
export function heldOutAnswerShortcuts(h: HeldOutBundle): { where: string; message: string }[] {
  const out: { where: string; message: string }[] = [];
  const rows = heldOutAnswers(h);
  const groups = new Map<string, HeldAnswer[]>();
  for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  for (const [g, rs] of groups) {
    if (rs.length < 2) continue;
    const pos = new Set(rs.flatMap((r) => r.positions));
    if (pos.size < 2) out.push({ where: `held-out group ${g}`, message: `the correct option is at position ${[...pos][0]} in every form (${rs.map((r) => r.item).join(', ')})` });
    const ans = rs.flatMap((r) => r.answers).filter((a): a is string => a !== null);
    if (ans.length === rs.flatMap((r) => r.answers).length && ans.length > 0 && new Set(ans).size < 2) {
      out.push({ where: `held-out group ${g}`, message: `the same correct answer (${ans[0]}) in every form (${rs.map((r) => r.item).join(', ')})` });
    }
  }
  const mods = new Map<string, string[]>();
  for (const r of rows) for (const a of r.answers) if (a !== null && !a.includes('|') && !a.includes('+')) mods.set(r.module, [...(mods.get(r.module) ?? []), a]);
  for (const [m, as] of mods) if (as.length > 1 && new Set(as).size < 2) out.push({ where: `held-out module ${m}`, message: `every action answer is ${as[0]}` });
  // Across families within a module: no single correct position or action may dominate.
  const byMod = new Map<string, HeldAnswer[]>();
  for (const r of rows) byMod.set(r.module, [...(byMod.get(r.module) ?? []), r]);
  for (const [m, rs] of byMod) {
    const pos = rs.map((r) => mode(r.positions));
    const top = maxShare(pos);
    if (rs.length >= 5 && top.n * 5 > rs.length * 2) out.push({ where: `held-out module ${m}`, message: `the correct option is at position ${top.v} in ${top.n} of ${rs.length} items` });
    for (const f of ['A', 'B', 'C']) {
      const fp = rs.filter((r) => r.form === f).map((r) => mode(r.positions));
      if (fp.length >= 2 && new Set(fp).size < 2) out.push({ where: `held-out module ${m} form ${f}`, message: `every correct option in this form is at position ${fp[0]}` });
    }
    const acts = rs.map((r) => mode(r.answers.filter((a): a is string => a !== null && !a.includes('|') && !a.includes('+')))).filter((a) => a !== undefined);
    const ta = maxShare(acts);
    if (acts.length >= 3 && ta.n * 3 > acts.length * 2) out.push({ where: `held-out module ${m}`, message: `${ta.n} of ${acts.length} action answers are ${ta.v}` });
  }
  return out;
}

export interface ModuleCounts { explanation: number; transfer: number; discovery: number; structures: number; substantiveSkins: number; scenarioItems: number }

/**
 * Plan §10.6 counts per module. Explanation items (all types) = discovery, practice and recognition items plus
 * slice reasoning questions assigned to a lesson (`scenarioItems`, counted once). Transfer items are counted
 * separately. Substantive skins exclude purposeful mirrors and transfer-only skins.
 */
export function contentCounts(b: ContentBundle): Record<string, ModuleCounts> {
  const out: Record<string, ModuleCounts> = {};
  for (const m of b.curriculum.modules) {
    const items = b.items.filter((i) => i.lesson.startsWith(`${m.id}.`));
    const practice = items.filter((i) => i.role !== 'transfer');
    const scenario = new Set(m.lessons.flatMap((l) => l.scenarioItems ?? []));
    const structures = new Set(b.structures.filter((s) => s.module === m.number).map((s) => s.id));
    const pskins = new Set(practice.flatMap((i) => i.skins));
    out[m.id] = {
      explanation: practice.length + scenario.size,
      transfer: items.filter((i) => i.role === 'transfer').length,
      discovery: items.filter((i) => i.role === 'discovery').length,
      structures: structures.size,
      substantiveSkins: b.skins.filter((k) => pskins.has(k.id) && !k.mirrorOf && k.structures.some((x) => structures.has(x))).length,
      scenarioItems: scenario.size,
    };
  }
  return out;
}

/** Slice questions assigned to lessons must name the lesson's scenario, exist, and be assigned once. */
export function validateScenarioItems(b: ContentBundle, questionIds: Record<string, string[]>, issues: Issue[]) {
  const seen = new Set<string>();
  for (const l of b.curriculum.modules.flatMap((m) => m.lessons)) {
    for (const ref of l.scenarioItems ?? []) {
      const [sc, q] = ref.split('#');
      const w = `lesson:${l.id}`;
      if (seen.has(ref)) issues.push({ rule: 'scenario-items', where: w, message: `${ref} is counted more than once` });
      seen.add(ref);
      if (sc !== l.scenario) issues.push({ rule: 'scenario-items', where: w, message: `${ref} is not from this lesson's scenario` });
      else if (!questionIds[sc!]?.includes(q ?? '')) issues.push({ rule: 'scenario-items', where: w, message: `${ref} is not a question of ${sc}` });
    }
  }
}

/**
 * Held-out vs practice separation only (plan §3.4, stricter reading): a held-out structure must not be
 * the same strategic form as a practised one up to ordinal rescaling, relabelling of either player's
 * actions, or swapping the players' seats. Not applied anywhere else (reuse within practice is legitimate).
 */
export function heldOutIsomorphisms(practice: Structure[], held: Structure[]): { held: string; heldParams: Record<string, number>; practice: string; practiceParams: Record<string, number>; how: string }[] {
  const out: { held: string; heldParams: Record<string, number>; practice: string; practiceParams: Record<string, number>; how: string }[] = [];
  const forms = practice.flatMap((p) => paramCombos(p).map((c) => {
    const m = matrices(p, c);
    return { id: p.id, c, sig: payoffSignature(p, c), relabel: ordinalForms(m.A, m.B, false), any: ordinalForms(m.A, m.B, true) };
  }));
  for (const hs of held) for (const hc of paramCombos(hs)) {
    const m = matrices(hs, hc);
    const key = ordinalKey(m.A, m.B);
    for (const f of forms) {
      if (!f.any.has(key)) continue;
      const how = payoffSignature(hs, hc) === f.sig ? 'raw duplicate' : f.relabel.has(key) ? 'same form up to action relabelling' : 'same form after a seat swap';
      out.push({ held: hs.id, heldParams: hc, practice: f.id, practiceParams: f.c, how });
    }
  }
  return out;
}

/**
 * A stated belief must not put weight on an action the believed-about player never benefits from
 * (strictly dominated for them) when the matrix is visible: the belief would contradict the incentives
 * the learner can read.
 */
export function validateBeliefCoherence(vars: ContentBundle['variations'], structures: Structure[], issues: Issue[]) {
  const byId = new Map(structures.map((s) => [s.id, s]));
  for (const v of vars) {
    const s = byId.get(v.structure);
    if (!v.belief || !s || s.presentation !== 'matrix') continue;
    const other = v.seat === 'A' ? 'B' : 'A';
    for (const c of paramCombos(s)) {
      const dominated = computeFacts(s, buildGame(s, c)).strictlyDominated[other];
      for (const [id, p] of Object.entries(v.belief)) {
        if (dominated.includes(id) && p !== '0' && p !== '0/1') issues.push({ rule: 'belief', where: `variation:${v.id}`, message: `belief puts ${p} on ${id}, which is strictly dominated for the other player and visible in the matrix` });
      }
    }
  }
}

const EXCLUSIVE = /\bonly (?:if|when)\b[^.;]*\b(?:both|same|match|together)\b|\b(?:works|gain|gains|pays|pay|come|comes) only (?:if|when)\b/iu;

/**
 * Narrative/payoff consistency for 2×2 coordination wording: "works only if both …" claims that every
 * miscoordinated outcome is equally bad, so each player's two off-diagonal payoffs must tie.
 */
export function validateExclusiveWording(skins: Skin[], structures: Structure[], issues: Issue[]) {
  const byId = new Map(structures.map((s) => [s.id, s]));
  for (const k of skins) for (const [key, text] of Object.entries(k.incentives)) {
    const s = byId.get(key.replace(/@B$/, ''));
    if (!s || s.actions.A.length !== 2 || s.actions.B.length !== 2 || !EXCLUSIVE.test(`${k.situation} ${text}`)) continue;
    for (const c of paramCombos(s)) {
      const m = matrices(s, c);
      for (const [who, M] of [['A', m.A], ['B', m.B]] as const) {
        if (M[0]![1] !== M[1]![0]) issues.push({ rule: 'narrative', where: `skin:${k.id}`, message: `says the outcome depends only on matching, but ${who}'s two miscoordinated payoffs differ (${M[0]![1]} vs ${M[1]![0]})` });
      }
    }
  }
}

/** Seat-rotation mirrors: explicit purpose, existing original on the same structure, other seat. */
export function validateMirrors(skins: Skin[], issues: Issue[]) {
  const byId = new Map(skins.map((k) => [k.id, k]));
  for (const k of skins) {
    if (!k.mirrorOf) {
      if (k.mirrorPurpose) issues.push({ rule: 'mirror', where: `skin:${k.id}`, message: 'mirrorPurpose without mirrorOf' });
      continue;
    }
    const o = byId.get(k.mirrorOf);
    if (!o) { issues.push({ rule: 'mirror', where: `skin:${k.id}`, message: `mirrorOf "${k.mirrorOf}" is not a skin` }); continue; }
    if (!k.mirrorPurpose?.trim()) issues.push({ rule: 'mirror', where: `skin:${k.id}`, message: 'a seat-rotation mirror needs an explicit learner-role purpose' });
    if (o.mirrorOf) issues.push({ rule: 'mirror', where: `skin:${k.id}`, message: 'mirror of a mirror' });
    if (!k.structures.every((x) => o.structures.includes(x))) issues.push({ rule: 'mirror', where: `skin:${k.id}`, message: 'mirror must use the original’s structure' });
    if (k.seats.some((x) => o.seats.includes(x))) issues.push({ rule: 'mirror', where: `skin:${k.id}`, message: 'mirror must put the learner in the other seat' });
  }
}

/** Distinct skins per structure (mirrors excluded), for plan §10.6 counts. */
export function skinCounts(skins: Skin[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of skins) if (!k.mirrorOf) for (const s of k.structures) out[s] = (out[s] ?? 0) + 1;
  return out;
}

export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `[${i.rule}] ${i.where}: ${i.message}`).join('\n');
}
