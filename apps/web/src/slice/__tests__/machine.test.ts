import { describe, expect, it } from 'vitest';
import { initialState, payoffs, step, bestResponses } from '@strategos/engine';
import { FIRST_SCENARIO as S, type Scenario } from '../../content';
import { initialAttempt, transition, isRevealed, STEPS, type AttemptState, type SliceEvent } from '../machine';
import { resolveOutcome, sampleOpponentAction, freshSeed, parseSeed } from '../engineFacts';

const AT = '2026-10-07T00:00:00.000Z';
const run = (events: SliceEvent[], st: AttemptState = initialAttempt(), s: Scenario = S) =>
  events.reduce((acc, ev) => transition(s, acc, ev), st);

const toDecide = (seed = 3): AttemptState =>
  run([
    { type: 'START', seed, at: AT },
    { type: 'CONTINUE' },
    { type: 'PREDICT', action: 1 },
    { type: 'SET_CONFIDENCE', value: 80 },
    { type: 'CONFIRM_CONFIDENCE' },
  ]);

describe('slice flow state machine', () => {
  it('walks intro → encounter → … → summary in order', () => {
    let st = initialAttempt();
    expect(st.step).toBe('intro');
    st = run([{ type: 'START', seed: 3, at: AT }], st);
    expect(st.step).toBe('encounter');
    st = run([{ type: 'CONTINUE' }], st);
    expect(st.step).toBe('predict');
    st = run([{ type: 'PREDICT', action: 1 }], st);
    expect(st.step).toBe('confidence');
    st = run([{ type: 'SET_CONFIDENCE', value: 80 }, { type: 'CONFIRM_CONFIDENCE' }], st);
    expect(st).toMatchObject({ step: 'decide', confidence: 80, prediction: 1 });
    st = run([{ type: 'DECIDE', action: 1, at: AT }], st);
    expect(st.step).toBe('response');
    st = run([{ type: 'CONTINUE' }], st);
    expect(st.step).toBe('outcome');
    st = run([{ type: 'CONTINUE' }], st);
    expect(st.step).toBe('matrix');
    st = run([{ type: 'CONTINUE' }], st);
    expect(st.step).toBe('explain');
    // FINISH is rejected until every structured question is answered.
    expect(run([{ type: 'FINISH', at: AT }], st)).toBe(st);
    st = run(S.questions.map((q) => ({ type: 'ANSWER', questionId: q.id, optionId: 'leave' }) as SliceEvent), st);
    st = run([{ type: 'FINISH', at: AT }], st);
    expect(st.step).toBe('summary');
    expect(st.completedAt).toBe(AT);
  });

  it('cannot reach the matrix (or any reveal) before deciding', () => {
    const generic: SliceEvent[] = [
      { type: 'CONTINUE' },
      { type: 'CONFIRM_CONFIDENCE' },
      { type: 'FINISH', at: AT },
      { type: 'BACK' },
      { type: 'SET_CONFIDENCE', value: 90 },
    ];
    for (const start of [run([{ type: 'START', seed: 1, at: AT }]), toDecide()]) {
      let st = start;
      for (let k = 0; k < 50; k++) {
        st = transition(S, st, generic[k % generic.length]!);
        expect(isRevealed(st.step)).toBe(false);
        expect(st.outcome).toBeNull();
        expect(st.opponentAction).toBeNull();
      }
    }
    // Only a DECIDE from the decide step reveals anything.
    const at = toDecide();
    expect(STEPS.indexOf(at.step)).toBeLessThan(STEPS.indexOf('matrix'));
    expect(run([{ type: 'DECIDE', action: 0, at: AT }], run([{ type: 'START', seed: 1, at: AT }])).step).toBe('encounter');
  });

  it('cannot select a joint outcome: only one own action is accepted', () => {
    const st = toDecide();
    const bad = [
      { type: 'DECIDE', action: [0, 1], at: AT },
      { type: 'DECIDE', action: { row: 0, col: 1 }, at: AT },
      { type: 'DECIDE', action: 2, at: AT },
      { type: 'DECIDE', action: -1, at: AT },
      { type: 'DECIDE', action: 0.5, at: AT },
      { type: 'SELECT_CELL', row: 0, col: 1 },
      { type: 'SELECT_OUTCOME', profile: [1, 0] },
    ] as unknown as SliceEvent[];
    for (const ev of bad) expect(transition(S, st, ev)).toBe(st);
    // The opponent's action never comes from the event.
    const decided = transition(S, st, { type: 'DECIDE', action: 0, at: AT, opponentAction: 0 } as unknown as SliceEvent);
    expect(decided.opponentAction).toBe(sampleOpponentAction(S, 3));
  });

  it('prediction accepts only opponent actions', () => {
    const st = run([{ type: 'START', seed: 1, at: AT }, { type: 'CONTINUE' }]);
    expect(transition(S, st, { type: 'PREDICT', action: [0, 0] } as unknown as SliceEvent)).toBe(st);
    expect(transition(S, st, { type: 'PREDICT', action: 5 })).toBe(st);
  });

  it('allows Back before the decision and never after the reveal', () => {
    const st = toDecide();
    expect(run([{ type: 'BACK' }], st).step).toBe('confidence');
    expect(run([{ type: 'BACK' }, { type: 'BACK' }], st).step).toBe('predict');
    expect(run([{ type: 'BACK' }, { type: 'BACK' }, { type: 'BACK' }], st).step).toBe('encounter');
    let after = run([{ type: 'DECIDE', action: 0, at: AT }], st);
    for (const _ of ['response', 'outcome', 'matrix', 'explain']) {
      expect(transition(S, after, { type: 'BACK' })).toBe(after);
      // Choice cannot be changed after locking in.
      expect(transition(S, after, { type: 'DECIDE', action: 1, at: AT })).toBe(after);
      after = transition(S, after, { type: 'CONTINUE' });
    }
  });

  it("B's action is reproducible from the seed", () => {
    for (let seed = 0; seed < 300; seed++) {
      const a = sampleOpponentAction(S, seed);
      expect(sampleOpponentAction(S, seed)).toBe(a);
      const viaFlow = run([{ type: 'DECIDE', action: 1, at: AT }], toDecide(seed));
      expect(viaFlow.opponentAction).toBe(a);
      expect(viaFlow.seed).toBe(seed);
    }
    expect(sampleOpponentAction(S, 1)).toBe(0); // documented replay seeds
    expect(sampleOpponentAction(S, 3)).toBe(1);
  });

  it('follows the declared 7/10 Leave it, 3/10 Clean policy (statistically)', () => {
    let clean = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) if (sampleOpponentAction(S, freshSeed(1_700_000_000_000)) === 0) clean++;
    expect(clean / N).toBeGreaterThan(0.26);
    expect(clean / N).toBeLessThan(0.34);
  });

  it('degenerate policies are respected exactly', () => {
    const always = (p: Record<string, string>): Scenario => ({ ...S, opponentPolicy: { ...S.opponentPolicy, probabilities: p } });
    for (let seed = 0; seed < 50; seed++) {
      expect(sampleOpponentAction(always({ clean: '1', leave: '0' }), seed)).toBe(0);
      expect(sampleOpponentAction(always({ clean: '0', leave: '1' }), seed)).toBe(1);
    }
  });

  it('the outcome cell is resolved by the engine', () => {
    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        const res = resolveOutcome(S, a, b);
        let st = initialState(S.game);
        st = step(S.game, st, { player: 0, action: a });
        st = step(S.game, st, { player: 1, action: b });
        expect(res.profile).toEqual([a, b]);
        expect(res.payoffs).toEqual(payoffs(S.game, st).map((x) => x.toString()));
      }
    }
    expect(resolveOutcome(S, 1, 1).payoffs).toEqual(['1', '1']);
    expect(resolveOutcome(S, 0, 1).payoffs).toEqual(['0', '5']);
    // Changing the content's game changes the result: nothing is hard-coded.
    const altered: Scenario = {
      ...S,
      game: { ...S.game, payoffs: [[['4', '4'], ['0', '3']], [['3', '0'], ['2', '2']]] },
    };
    expect(resolveOutcome(altered, 0, 0).payoffs).toEqual(['4', '4']);
    expect(bestResponses(altered.game, 0, 0)).toEqual([0]);
    const st = run([{ type: 'DECIDE', action: 0, at: AT }], toDecide(1), altered);
    expect(st.outcome).toEqual(resolveOutcome(altered, 0, st.opponentAction!));
  });

  it('answers lock once given and must be valid options', () => {
    let st = run([{ type: 'DECIDE', action: 0, at: AT }, { type: 'CONTINUE' }, { type: 'CONTINUE' }, { type: 'CONTINUE' }], toDecide());
    expect(st.step).toBe('explain');
    expect(transition(S, st, { type: 'ANSWER', questionId: 'if-b-cleans', optionId: '__none__' })).toBe(st);
    expect(transition(S, st, { type: 'ANSWER', questionId: 'nope', optionId: 'clean' })).toBe(st);
    st = transition(S, st, { type: 'ANSWER', questionId: 'if-b-cleans', optionId: 'clean' });
    expect(transition(S, st, { type: 'ANSWER', questionId: 'if-b-cleans', optionId: 'leave' })).toBe(st);
    st = transition(S, st, { type: 'ANSWER', questionId: 'either-way', optionId: '__none__' });
    expect(st.answers['either-way']).toBe('__none__');
  });

  it('Try again starts a fresh attempt with a new seed', () => {
    let st = toDecide(3);
    st = run([{ type: 'DECIDE', action: 1, at: AT }, { type: 'CONTINUE' }, { type: 'CONTINUE' }, { type: 'CONTINUE' }], st);
    st = run(S.questions.map((q) => ({ type: 'ANSWER', questionId: q.id, optionId: 'leave' }) as SliceEvent), st);
    st = run([{ type: 'FINISH', at: AT }], st);
    const again = transition(S, st, { type: 'RESTART', seed: 99, at: AT });
    expect(again).toMatchObject({ step: 'encounter', seed: 99, prediction: null, choice: null, outcome: null, answers: {} });
    expect(transition(S, toDecide(), { type: 'RESTART', seed: 5, at: AT }).step).toBe('decide');
    expect(freshSeed(1)).not.toBe(freshSeed(1));
  });

  it('confidence is limited to 50–100 in steps of 5', () => {
    const st = run([{ type: 'START', seed: 1, at: AT }, { type: 'CONTINUE' }, { type: 'PREDICT', action: 0 }]);
    for (const bad of [45, 101, 77, 'x']) expect(transition(S, st, { type: 'SET_CONFIDENCE', value: bad as number })).toBe(st);
    expect(transition(S, st, { type: 'SET_CONFIDENCE', value: 100 }).confidence).toBe(100);
    expect(transition(S, st, { type: 'SET_CONFIDENCE', value: 50 }).confidence).toBe(50);
  });

  it('parses replay seeds from the URL', () => {
    expect(parseSeed(null)).toBeNull();
    expect(parseSeed('abc')).toBeNull();
    expect(parseSeed('3')).toBe(3);
  });
});
