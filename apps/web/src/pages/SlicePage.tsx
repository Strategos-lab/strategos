import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FIRST_SCENARIO, contextFieldsAt, type Scenario } from '../content';
import { InstallCard } from '../components/InstallCard';
import { ConfidenceControl } from '../components/ConfidenceControl';
import { PayoffMatrix } from '../components/PayoffMatrix';
import {
  closingNote,
  decisionConsistency,
  dominantAction,
  fillTemplate,
  freshSeed,
  learnerActions,
  learnerLabel,
  opponentActions,
  opponentLabel,
  parseSeed,
  questionFeedback,
  questionOptions,
} from '../slice/engineFacts';
import {
  CONFIDENCE_MAX,
  CONFIDENCE_MIN,
  CONFIDENCE_STEP,
  STEPS,
  allAnswered,
  initialAttempt,
  transition,
  type AttemptState,
  type SliceEvent,
  type Step,
} from '../slice/machine';
import { persistAttempt } from '../slice/attemptRecord';

const FLOW_STEPS: readonly Step[] = STEPS.filter((s) => s !== 'intro');
const nowIso = () => new Date().toISOString();

/** First learner-facing experience: one complete roommate encounter, driven by content + engine. */
export function SlicePage({ scenario = FIRST_SCENARIO }: { scenario?: Scenario }) {
  const [params] = useSearchParams();
  const urlSeed = parseSeed(params.get('seed'));
  const [state, dispatch] = useReducer(
    (st: AttemptState, ev: SliceEvent) => transition(scenario, st, ev),
    undefined,
    initialAttempt,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [saveNote, setSaveNote] = useState('');
  const savedKey = useRef<string | null>(null);

  // Move focus to each new step's heading (and to the top of the page).
  useEffect(() => {
    if (state.step === 'intro') return;
    try {
      window.scrollTo(0, 0);
    } catch {
      /* not available (tests) */
    }
    headingRef.current?.focus();
  }, [state.step]);

  // Persist each completed attempt once.
  useEffect(() => {
    if (state.step !== 'summary') return;
    const key = `${state.seed}:${state.startedAt}`;
    if (savedKey.current === key) return;
    savedKey.current = key;
    persistAttempt(scenario, state).then(
      () => setSaveNote('Attempt saved on this device.'),
      () => setSaveNote('This attempt could not be saved on this device.'),
    );
  }, [scenario, state]);

  const seedFor = () => urlSeed ?? freshSeed();

  if (state.step === 'intro') {
    return (
      <main className="home">
        <header className="hero">
          <p className="eyebrow">Strategic thinking laboratory</p>
          <h1>STRATEGOS</h1>
          <p className="lede">
            Work through a real-life situation: predict, decide, then see the structure behind what
            happened. Runs on this device only.
          </p>
        </header>
        <InstallCard />
        <section className="step-card start-card" aria-labelledby="start-heading">
          <p className="eyebrow">First situation</p>
          <h2 id="start-heading">{scenario.title}</h2>
          <button
            type="button"
            className="btn primary btn-large"
            data-testid="btn-start"
            onClick={() => dispatch({ type: 'START', seed: seedFor(), at: nowIso() })}
          >
            Start
          </button>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="home flow" data-step={state.step}>
      <header className="flow-head">
        <p className="eyebrow">STRATEGOS</p>
        <h1 className="flow-title">{scenario.title}</h1>
      </header>
      <StepBody scenario={scenario} state={state} dispatch={dispatch} headingRef={headingRef} restartSeed={freshSeed} />
      {state.step === 'summary' && saveNote ? (
        <p className="muted small" role="status" data-testid="save-note">
          {saveNote}
        </p>
      ) : null}
      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <p className="muted small">
        <Link to="/data">Data &amp; app</Link>
      </p>
    </footer>
  );
}

interface StepProps {
  scenario: Scenario;
  state: AttemptState;
  dispatch: (ev: SliceEvent) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Try again always draws a fresh seed. */
  restartSeed: () => number;
}

function Card({
  step,
  title,
  headingRef,
  children,
}: {
  step: Step;
  title: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  const n = FLOW_STEPS.indexOf(step) + 1;
  return (
    <section className="step-card" aria-labelledby="step-heading" data-testid={`step-${step}`}>
      <p className="step-count">
        Step {n} of {FLOW_STEPS.length}
      </p>
      <h2 id="step-heading" tabIndex={-1} ref={headingRef}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function BackButton({ dispatch }: { dispatch: (ev: SliceEvent) => void }) {
  return (
    <button type="button" className="btn ghost btn-large" onClick={() => dispatch({ type: 'BACK' })}>
      Back
    </button>
  );
}

function ContinueButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="btn primary btn-large" onClick={onClick} disabled={disabled} data-testid="btn-continue">
      Continue
    </button>
  );
}

function StepBody({ scenario: s, state, dispatch, headingRef, restartSeed }: StepProps) {
  const own = learnerActions(s);
  const opp = opponentActions(s);
  const A = learnerLabel(s);
  const B = opponentLabel(s);

  switch (state.step) {
    case 'encounter':
      return (
        <Card step="encounter" title="The situation" headingRef={headingRef}>
          <div className="story">
            {contextFieldsAt('story').map(({ key }) => (
              <p key={key} data-testid={`context-${key}`}>
                {s.context[key]}
              </p>
            ))}
            <p className="role-statement" data-testid="role-statement">
              {s.roleStatement}
            </p>
          </div>
          <dl className="glance" aria-label="At a glance" data-testid="glance">
            {contextFieldsAt('glance').map(({ key, shortLabel }) => (
              <div key={key} className="glance-row" data-testid={`context-${key}`}>
                <dt>{shortLabel}</dt>
                <dd>{s.context[key]}</dd>
              </div>
            ))}
          </dl>
          <div className="context-details">
            {contextFieldsAt('details').map(({ key, shortLabel }) => (
              <details key={key} className="disclosure" data-testid={`context-${key}`}>
                <summary>{shortLabel}</summary>
                <p>{s.context[key]}</p>
              </details>
            ))}
          </div>
          <div className="btn-row step-actions">
            <ContinueButton onClick={() => dispatch({ type: 'CONTINUE' })} />
          </div>
        </Card>
      );

    case 'predict':
      return (
        <Card step="predict" title={s.prompts.predict} headingRef={headingRef}>
          <div className="choice-list" role="group" aria-label={`Your prediction for ${B}`}>
            {opp.map((a, i) => (
              <button
                key={a.id}
                type="button"
                className="btn choice-btn"
                aria-pressed={state.prediction === i}
                onClick={() => dispatch({ type: 'PREDICT', action: i })}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="btn-row step-actions">
            <BackButton dispatch={dispatch} />
          </div>
        </Card>
      );

    case 'confidence': {
      const predicted = opp[state.prediction!]!.label;
      return (
        <Card step="confidence" title={fillTemplate(s.prompts.confidence, { prediction: predicted })} headingRef={headingRef}>
          <ConfidenceControl
            value={state.confidence}
            onChange={(value) => dispatch({ type: 'SET_CONFIDENCE', value })}
            min={CONFIDENCE_MIN}
            max={CONFIDENCE_MAX}
            step={CONFIDENCE_STEP}
            label={`Confidence that ${B} chooses ${predicted}`}
          />
          <div className="btn-row step-actions">
            <BackButton dispatch={dispatch} />
            <ContinueButton onClick={() => dispatch({ type: 'CONFIRM_CONFIDENCE' })} />
          </div>
        </Card>
      );
    }

    case 'decide':
      return (
        <Card step="decide" title={s.prompts.decide} headingRef={headingRef}>
          <p className="muted">{s.prompts.decideNote}</p>
          <div className="choice-list" role="group" aria-label="Your choice">
            {own.map((a, i) => (
              <button
                key={a.id}
                type="button"
                className="btn choice-btn"
                onClick={() => dispatch({ type: 'DECIDE', action: i, at: nowIso() })}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="btn-row step-actions">
            <BackButton dispatch={dispatch} />
          </div>
        </Card>
      );

    case 'response':
      return (
        <Card step="response" title="Both choices are in" headingRef={headingRef}>
          <p className="reveal-line" data-testid="response-text">
            You chose <strong>{own[state.choice!]!.label}</strong>. {B} chose{' '}
            <strong>{opp[state.opponentAction!]!.label}</strong>.
          </p>
          <div className="btn-row step-actions">
            <ContinueButton onClick={() => dispatch({ type: 'CONTINUE' })} />
          </div>
        </Card>
      );

    case 'outcome': {
      const [you, them] = state.outcome!.payoffs;
      const key = `${own[state.choice!]!.id}|${opp[state.opponentAction!]!.id}`;
      return (
        <Card step="outcome" title="What happened" headingRef={headingRef}>
          <p className="reveal-line" data-testid="outcome-words">
            You get <strong>{you}</strong>. {B} gets <strong>{them}</strong>.
          </p>
          <p data-testid="outcome-story">{s.outcomes[key]}</p>
          <p className="outcome-pair" data-testid="outcome-pair">
            Outcome: ({you}, {them})
          </p>
          <p className="muted small">The first number is yours ({A}); the second is {B}’s.</p>
          <div className="btn-row step-actions">
            <ContinueButton onClick={() => dispatch({ type: 'CONTINUE' })} />
          </div>
        </Card>
      );
    }

    case 'matrix': {
      const [i, j] = state.outcome!.profile;
      return (
        <Card step="matrix" title="The whole situation" headingRef={headingRef}>
          <p>{s.matrix.intro}</p>
          <PayoffMatrix
            mode="read-only"
            rowPlayerLabel={`${A} (you)`}
            colPlayerLabel={B}
            rowActions={own.map((a) => a.label)}
            colActions={opp.map((a) => a.label)}
            payoffs={s.game.payoffs.map((row) => row.map((cell) => [cell[0]!, cell[1]!] as const))}
            highlight={{ row: i, col: j }}
            rowMark="your choice"
            colMark={`${B}’s choice`}
            highlightLabel="what happened"
          />
          <ul className="how-to-read">
            {s.matrix.howToRead.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="muted small" data-testid="matrix-landing">
            You chose the row “{own[i]!.label}”. {B} chose the column “{opp[j]!.label}”. Together:
            ({state.outcome!.payoffs[0]}, {state.outcome!.payoffs[1]}).
          </p>
          <div className="btn-row step-actions">
            <ContinueButton onClick={() => dispatch({ type: 'CONTINUE' })} />
          </div>
        </Card>
      );
    }

    case 'explain':
      return <ExplainStep scenario={s} state={state} dispatch={dispatch} headingRef={headingRef} restartSeed={restartSeed} />;

    case 'summary':
      return <SummaryStep scenario={s} state={state} dispatch={dispatch} headingRef={headingRef} restartSeed={restartSeed} />;

    default:
      return null;
  }
}

function ExplainStep({ scenario: s, state, dispatch, headingRef }: StepProps) {
  // Questions appear one at a time; each locks once answered.
  const firstOpen = s.questions.findIndex((q) => !(q.id in state.answers));
  const visible = firstOpen === -1 ? s.questions : s.questions.slice(0, firstOpen + 1);
  const done = allAnswered(s, state);
  const note = useMemo(() => (done ? closingNote(s) : null), [done, s]);
  return (
    <Card step="explain" title="Check your reasoning" headingRef={headingRef}>
      <p className="muted">Look at the table again and answer from your side ({learnerLabel(s)}).</p>
      {visible.map((q, qi) => {
        const answer = state.answers[q.id];
        const fb = answer !== undefined ? questionFeedback(s, q, answer) : null;
        return (
          <fieldset key={q.id} className="question" data-testid={`question-${q.id}`}>
            <legend>
              <span className="q-index">{String.fromCharCode(97 + qi)}.</span> {q.prompt}
            </legend>
            <div className="choice-list">
              {questionOptions(s, q).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`btn choice-btn${answer === o.id ? ' chosen' : ''}`}
                  aria-pressed={answer === o.id}
                  disabled={answer !== undefined}
                  onClick={() => dispatch({ type: 'ANSWER', questionId: q.id, optionId: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {fb ? (
              <p className={`feedback ${fb.correct ? 'ok' : 'miss'}`} role="status" data-testid={`feedback-${q.id}`}>
                {fb.text}
              </p>
            ) : null}
          </fieldset>
        );
      })}
      {note ? (
        <p className="closing-note" data-testid="closing-note">
          {note}
        </p>
      ) : null}
      <div className="btn-row step-actions">
        <ContinueButton disabled={!done} onClick={() => dispatch({ type: 'FINISH', at: nowIso() })} />
      </div>
    </Card>
  );
}

function SummaryStep({ scenario: s, state, dispatch, headingRef, restartSeed }: StepProps) {
  const own = learnerActions(s);
  const opp = opponentActions(s);
  const B = opponentLabel(s);
  const predicted = opp[state.prediction!]!.label;
  const actual = opp[state.opponentAction!]!.label;
  const chosen = own[state.choice!]!.label;
  const consistency = decisionConsistency(s, state.prediction!, state.confidence, state.choice!);
  const bestToPrediction = consistency.best.map((i) => own[i]!.label).join(' / ');
  const dom = dominantAction(s);
  const [you, them] = state.outcome!.payoffs;
  return (
    <Card step="summary" title="Summary" headingRef={headingRef}>
      <dl className="summary-list">
        <div className="summary-item" data-testid="summary-prediction">
          <dt>Your prediction</dt>
          <dd>
            You predicted {B} would choose <strong>{predicted}</strong>, with {state.confidence}% confidence. {B}{' '}
            actually chose <strong>{actual}</strong>.
          </dd>
        </div>
        <div className="summary-item" data-testid="summary-decision">
          <dt>Decision: judged on what you knew</dt>
          <dd>
            You chose <strong>{chosen}</strong>.{' '}
            {consistency.consistent
              ? `That was the best reply to your own prediction.`
              : `That was not the best reply to your own prediction: given what you predicted, ${bestToPrediction} would have served you better.`}
            {dom !== null ? ` (${own[dom]!.label} gives you more whatever ${B} does.)` : null}
          </dd>
        </div>
        <div className="summary-item" data-testid="summary-outcome">
          <dt>Outcome: what actually happened</dt>
          <dd>
            You got <strong>{you}</strong>; {B} got <strong>{them}</strong>. Outcome: ({you}, {them}). This part also
            depended on {B}’s draw, which is luck from your point of view. It does not change the judgement of your
            decision above.
          </dd>
        </div>
        <div className="summary-item" data-testid="summary-policy">
          <dt>How {B} decided</dt>
          <dd>
            {s.opponentPolicy.description} <span className="muted small">Seed {state.seed}.</span>
          </dd>
        </div>
      </dl>
      <div className="btn-row step-actions">
        <button
          type="button"
          className="btn primary btn-large"
          data-testid="btn-try-again"
          onClick={() => dispatch({ type: 'RESTART', seed: restartSeed(), at: nowIso() })}
        >
          Try again
        </button>
      </div>
    </Card>
  );
}
