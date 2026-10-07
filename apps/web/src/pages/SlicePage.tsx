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
import { feedbackParts, statusLabel } from '../ui/feedbackParts';

const FLOW_STEPS: readonly Step[] = STEPS.filter((s) => s !== 'intro');
const nowIso = () => new Date().toISOString();
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Short UI chrome names for the step indicator (presentation only). */
const STEP_NAMES: Record<Exclude<Step, 'intro'>, string> = {
  encounter: 'The situation',
  predict: 'Prediction',
  confidence: 'Confidence',
  decide: 'Decision',
  response: 'Reveal',
  outcome: 'Outcome',
  matrix: 'The table',
  explain: 'Reasoning',
  summary: 'Summary',
};

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
      <main className="page page-intro">
        <header className="intro-head">
          <p className="label">Strategic thinking laboratory</p>
          <h1 className="wordmark wordmark-lg">STRATEGOS</h1>
          <p className="intro-lede">
            Work through a real-life situation: predict, decide, then see the structure behind what
            happened. Runs on this device only.
          </p>
        </header>
        <InstallCard />
        <section className="start" aria-labelledby="start-heading">
          <p className="label">First situation</p>
          <h2 id="start-heading" className="start-title">
            {scenario.title}
          </h2>
          <button
            type="button"
            className="btn btn-primary btn-block"
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
    <main className="page page-flow" data-step={state.step}>
      <header className="flow-head">
        <p className="wordmark" aria-hidden="true">
          STRATEGOS
        </p>
        <h1 className="flow-title">{scenario.title}</h1>
      </header>
      <StepBody scenario={scenario} state={state} dispatch={dispatch} headingRef={headingRef} restartSeed={freshSeed} />
      {state.step === 'summary' && saveNote ? (
        <p className="meta" role="status" data-testid="save-note">
          {saveNote}
        </p>
      ) : null}
      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer className="page-foot">
      <Link to="/data" className="quiet-link">
        Data &amp; app
      </Link>
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

/**
 * One step of the flow. No outer card: the page is the canvas. `variant` sets the heading level of
 * emphasis: 'question' (L1, the decision), 'title' (secondary heading), 'label' (the heading is the
 * step indicator itself; the content below carries the weight).
 */
function StepView({
  step,
  title,
  headingRef,
  variant,
  children,
}: {
  step: Exclude<Step, 'intro'>;
  title: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  variant: 'question' | 'title' | 'label';
  children: ReactNode;
}) {
  const n = FLOW_STEPS.indexOf(step) + 1;
  const heading = (
    <h2 id="step-heading" tabIndex={-1} ref={headingRef} className={`step-heading step-heading-${variant}`}>
      {title}
    </h2>
  );
  return (
    <section className={`step step-${step}`} aria-labelledby="step-heading" data-testid={`step-${step}`}>
      <div className="step-indicator">
        <span className="step-num">
          <span aria-hidden="true">
            {pad2(n)} / {pad2(FLOW_STEPS.length)}
          </span>
          <span className="sr-only">
            Step {n} of {FLOW_STEPS.length}
          </span>
        </span>
        {variant === 'label' ? heading : <span className="step-name">{STEP_NAMES[step]}</span>}
      </div>
      {variant === 'label' ? null : heading}
      {children}
    </section>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="actions">{children}</div>;
}

function BackButton({ dispatch }: { dispatch: (ev: SliceEvent) => void }) {
  return (
    <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: 'BACK' })}>
      Back
    </button>
  );
}

function ContinueButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="btn btn-primary" onClick={onClick} disabled={disabled} data-testid="btn-continue">
      Continue
    </button>
  );
}

/** Label + value pair whose text content still reads as a statement ("You chose Clean."). */
function Said({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`said ${className ?? ''}`}>
      <span className="said-label">{label}</span>{' '}
      <strong className="said-value">{value}</strong>
      <span className="sr-only">.</span>
    </div>
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
        <StepView step="encounter" title="The situation" variant="label" headingRef={headingRef}>
          <div className="story">
            {contextFieldsAt('story').map(({ key }) => (
              <p key={key} className="prose-lead" data-testid={`context-${key}`}>
                {s.context[key]}
              </p>
            ))}
            <p className="role-statement" data-testid="role-statement">
              {s.roleStatement}
            </p>
          </div>
          <hr className="rule" />
          <section className="glance-block" aria-labelledby="glance-label">
            <h3 id="glance-label" className="label">
              At a glance
            </h3>
            <dl className="glance" data-testid="glance">
              {contextFieldsAt('glance').map(({ key, shortLabel }) => (
                <div key={key} className="glance-row" data-testid={`context-${key}`}>
                  <dt>{shortLabel}</dt>
                  <dd>{s.context[key]}</dd>
                </div>
              ))}
            </dl>
          </section>
          <hr className="rule" />
          <section className="more" aria-labelledby="more-label">
            <h3 id="more-label" className="label">
              More about the situation
            </h3>
            <div className="disclosures">
              {contextFieldsAt('details').map(({ key, shortLabel }) => (
                <details key={key} className="disclosure" data-testid={`context-${key}`}>
                  <summary>{shortLabel}</summary>
                  <p>{s.context[key]}</p>
                </details>
              ))}
            </div>
          </section>
          <Actions>
            <ContinueButton onClick={() => dispatch({ type: 'CONTINUE' })} />
          </Actions>
        </StepView>
      );

    case 'predict':
      return (
        <StepView step="predict" title={s.prompts.predict} variant="question" headingRef={headingRef}>
          <div className="choices" role="group" aria-label={`Your prediction for ${B}`}>
            {opp.map((a, i) => (
              <button
                key={a.id}
                type="button"
                className="choice"
                aria-pressed={state.prediction === i}
                onClick={() => dispatch({ type: 'PREDICT', action: i })}
              >
                {a.label}
              </button>
            ))}
          </div>
          <Actions>
            <BackButton dispatch={dispatch} />
          </Actions>
        </StepView>
      );

    case 'confidence': {
      const predicted = opp[state.prediction!]!.label;
      return (
        <StepView step="confidence" title={fillTemplate(s.prompts.confidence, { prediction: predicted })} variant="question" headingRef={headingRef}>
          <div className="prediction-recap" aria-hidden="true">
            <span className="label">{B}</span>
            <span className="recap-value">{predicted}</span>
          </div>
          <ConfidenceControl
            value={state.confidence}
            onChange={(value) => dispatch({ type: 'SET_CONFIDENCE', value })}
            min={CONFIDENCE_MIN}
            max={CONFIDENCE_MAX}
            step={CONFIDENCE_STEP}
            label={`Confidence that ${B} chooses ${predicted}`}
            variant="hero"
          />
          <Actions>
            <BackButton dispatch={dispatch} />
            <ContinueButton onClick={() => dispatch({ type: 'CONFIRM_CONFIDENCE' })} />
          </Actions>
        </StepView>
      );
    }

    case 'decide':
      return (
        <StepView step="decide" title={s.prompts.decide} variant="question" headingRef={headingRef}>
          <div className="choices" role="group" aria-label="Your choice">
            {own.map((a, i) => (
              <button key={a.id} type="button" className="choice" onClick={() => dispatch({ type: 'DECIDE', action: i, at: nowIso() })}>
                {a.label}
              </button>
            ))}
          </div>
          <p className="note">{s.prompts.decideNote}</p>
          <Actions>
            <BackButton dispatch={dispatch} />
          </Actions>
        </StepView>
      );

    case 'response':
      return (
        <StepView step="response" title="Both choices are in" variant="title" headingRef={headingRef}>
          <div className="reveal" data-testid="response-text">
            <Said label="You chose" value={own[state.choice!]!.label} className="said-you" />{' '}
            <Said label={`${B} chose`} value={opp[state.opponentAction!]!.label} className="said-them" />
          </div>
          <Actions>
            <ContinueButton onClick={() => dispatch({ type: 'CONTINUE' })} />
          </Actions>
        </StepView>
      );

    case 'outcome': {
      const [you, them] = state.outcome!.payoffs;
      const key = `${own[state.choice!]!.id}|${opp[state.opponentAction!]!.id}`;
      return (
        <StepView step="outcome" title="What happened" variant="title" headingRef={headingRef}>
          <div className="scores" data-testid="outcome-words">
            <div className="score score-you">
              <span className="said-label">You get</span> <strong className="score-value">{you}</strong>
              <span className="sr-only">.</span>
            </div>{' '}
            <div className="score score-them">
              <span className="said-label">{B} gets</span> <strong className="score-value">{them}</strong>
              <span className="sr-only">.</span>
            </div>
          </div>
          <p className="prose" data-testid="outcome-story">
            {s.outcomes[key]}
          </p>
          <div className="notation">
            <p className="mono-meta" data-testid="outcome-pair">
              Outcome: ({you}, {them})
            </p>
            <p className="meta">
              The first number is yours ({A}); the second is {B}’s.
            </p>
          </div>
          <Actions>
            <ContinueButton onClick={() => dispatch({ type: 'CONTINUE' })} />
          </Actions>
        </StepView>
      );
    }

    case 'matrix': {
      const [i, j] = state.outcome!.profile;
      return (
        <StepView step="matrix" title="The whole situation" variant="title" headingRef={headingRef}>
          <p className="prose">{s.matrix.intro}</p>
          <PayoffMatrix
            mode="read-only"
            rowPlayerLabel={`${A} (you)`}
            colPlayerLabel={B}
            rowAxisLabel="You"
            rowActions={own.map((a) => a.label)}
            colActions={opp.map((a) => a.label)}
            payoffs={s.game.payoffs.map((row) => row.map((cell) => [cell[0]!, cell[1]!] as const))}
            highlight={{ row: i, col: j }}
            rowMark="your choice"
            colMark={`${B}’s choice`}
            highlightLabel="what happened"
          />
          <ul className="quiet-list">
            {s.matrix.howToRead.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="meta" data-testid="matrix-landing">
            You chose the row “{own[i]!.label}”. {B} chose the column “{opp[j]!.label}”. Together: ({state.outcome!.payoffs[0]},{' '}
            {state.outcome!.payoffs[1]}).
          </p>
          <Actions>
            <ContinueButton onClick={() => dispatch({ type: 'CONTINUE' })} />
          </Actions>
        </StepView>
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
    <StepView step="explain" title="Check your reasoning" variant="title" headingRef={headingRef}>
      <p className="note">Look at the table again and answer from your side ({learnerLabel(s)}).</p>
      {visible.map((q, qi) => {
        const answer = state.answers[q.id];
        const fb = answer !== undefined ? questionFeedback(s, q, answer) : null;
        const parts = fb ? feedbackParts(fb.text) : null;
        const promptId = `q-${q.id}`;
        return (
          <section key={q.id} className="question" data-testid={`question-${q.id}`} aria-labelledby={promptId}>
            <p className="question-num">
              Question {qi + 1} / {s.questions.length}
            </p>
            <h3 id={promptId} className="question-prompt">
              {q.prompt}
            </h3>
            <div className="choices choices-compact" role="group" aria-labelledby={promptId}>
              {questionOptions(s, q).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="choice choice-compact"
                  aria-pressed={answer === o.id}
                  disabled={answer !== undefined}
                  onClick={() => dispatch({ type: 'ANSWER', questionId: q.id, optionId: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {fb && parts ? (
              <div className={`feedback ${fb.correct ? 'is-correct' : 'is-miss'}`} role="status" data-testid={`feedback-${q.id}`}>
                <p className="feedback-status">{statusLabel(fb.correct)}</p>
                <p className="feedback-headline">{parts.headline}</p>
                {parts.hasMore ? (
                  <details className="why">
                    <summary>Why</summary>
                    <p>{parts.full}</p>
                  </details>
                ) : (
                  <span className="sr-only">{parts.full}</span>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
      {note ? (
        <p className="closing-note" data-testid="closing-note">
          {note}
        </p>
      ) : null}
      <Actions>
        <ContinueButton disabled={!done} onClick={() => dispatch({ type: 'FINISH', at: nowIso() })} />
      </Actions>
    </StepView>
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
    <StepView step="summary" title="Summary" variant="label" headingRef={headingRef}>
      <section aria-labelledby="run-label">
        <h3 id="run-label" className="label">
          Your run
        </h3>
        <dl className="run" data-testid="run">
          <div className="run-row">
            <dt>Prediction</dt>
            <dd>
              {predicted} <span className="mono-dim">· {state.confidence}%</span>
            </dd>
          </div>
          <div className="run-row">
            <dt>Actual</dt>
            <dd>
              {actual} <span className="dim">({B})</span>
            </dd>
          </div>
          <div className="run-row">
            <dt>Decision</dt>
            <dd>{chosen}</dd>
          </div>
          <div className="run-row">
            <dt>Decision quality</dt>
            <dd className="emph">{consistency.consistent ? 'Best reply to your prediction' : 'Not the best reply to your prediction'}</dd>
          </div>
          <div className="run-row">
            <dt>Outcome</dt>
            <dd className="mono">
              {you} <span className="dim">·</span> <span className="dim">{them}</span>
            </dd>
          </div>
        </dl>
        <details className="disclosure disclosure-quiet">
          <summary>Your prediction in words</summary>
          <p data-testid="summary-prediction">
            You predicted {B} would choose <strong>{predicted}</strong>, with {state.confidence}% confidence. {B} actually chose{' '}
            <strong>{actual}</strong>.
          </p>
        </details>
      </section>

      <hr className="rule" />

      <section aria-labelledby="notice-label">
        <h3 id="notice-label" className="label">
          What to notice
        </h3>
        <div className="notice">
          <div className="notice-item" data-testid="summary-decision">
            <p className="notice-head">Decision: judged on what you knew</p>
            <p>
              You chose <strong>{chosen}</strong>.{' '}
              {consistency.consistent
                ? `That was the best reply to your own prediction.`
                : `That was not the best reply to your own prediction: given what you predicted, ${bestToPrediction} would have served you better.`}
              {dom !== null ? ` (${own[dom]!.label} gives you more whatever ${B} does.)` : null}
            </p>
          </div>
          <div className="notice-item" data-testid="summary-outcome">
            <p className="notice-head">Outcome: what actually happened</p>
            <p>
              You got <strong>{you}</strong>; {B} got <strong>{them}</strong>. Outcome: ({you}, {them}). This part also depended on {B}’s draw,
              which is luck from your point of view. It does not change the judgement of your decision above.
            </p>
          </div>
          <div className="notice-item" data-testid="summary-policy">
            <p className="notice-head">How {B} decided</p>
            <p className="dim">
              {s.opponentPolicy.description} <span className="mono-dim">Seed {state.seed}.</span>
            </p>
          </div>
        </div>
      </section>

      <Actions>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="btn-try-again"
          onClick={() => dispatch({ type: 'RESTART', seed: restartSeed(), at: nowIso() })}
        >
          Try again
        </button>
      </Actions>
    </StepView>
  );
}
