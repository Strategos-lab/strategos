import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  PLAY_CONTENT,
  diagnose,
  feedbackFor,
  lessonOrder,
  render,
  storyText,
  termAllowed,
  type Diagnosis,
  type Item,
  type Lesson,
  type Response,
} from '@strategos/content/play';
import { InstallCard } from '../components/InstallCard';
import { PageFooter } from '../components/PageFooter';
import { freshSeed, instanceFor, parseSeed } from '../lesson/lessonInstances';
import { advance, advanceSelfAssessed, currentItem, isComplete, startLesson, type LessonSession } from '../lesson/lessonSession';
import { persistLessonAttempt } from '../lesson/lessonAttemptRecord';

const nowIso = () => new Date().toISOString();
const pad2 = (n: number) => String(n).padStart(2, '0');
const LESSON_ORDER = lessonOrder(PLAY_CONTENT.curriculum);
const SLOT_TOKEN = /\{slot:([^{}]*)\}/g;

function findLesson(lessonId: string): Lesson {
  for (const m of PLAY_CONTENT.curriculum.modules) {
    const lesson = m.lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson;
  }
  throw new Error(`unknown lesson "${lessonId}"`);
}

function lessonItems(lesson: Lesson): Item[] {
  return lesson.items.map((id) => {
    const item = PLAY_CONTENT.items.find((i) => i.id === id);
    if (!item) throw new Error(`${lesson.id}: unknown item "${id}"`);
    return item;
  });
}

/** Split a fill_in prompt into rendered text segments and the blanks ({slot:id}) between them. */
function promptParts(prompt: string): Array<{ text: string } | { slot: string }> {
  const parts: Array<{ text: string } | { slot: string }> = [];
  let last = 0;
  for (const m of prompt.matchAll(SLOT_TOKEN)) {
    parts.push({ text: prompt.slice(last, m.index) });
    parts.push({ slot: m[1]! });
    last = m.index! + m[0].length;
  }
  parts.push({ text: prompt.slice(last) });
  return parts;
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="actions">{children}</div>;
}

/**
 * Generic lesson player: walks any lesson's item list end to end, item by item, driven entirely by
 * `@strategos/content`'s Item/Instance model — distinct from the roommate slice (`SlicePage.tsx`),
 * which models one fixed predict/decide/reveal encounter. Handles `reason_choice`, `fill_in` and
 * `own_words` (self-assessed, not engine-checked) items; a lesson built on the roommate scenario
 * (`scenario` field set) is excluded from the lesson menu rather than attempted here.
 */
export function LessonPage({ lessonId: lessonIdProp }: { lessonId?: string }) {
  const params = useParams<{ lessonId: string }>();
  const lessonId = lessonIdProp ?? params.lessonId ?? 'm1.l1';
  const lesson = useMemo(() => findLesson(lessonId), [lessonId]);
  const items = useMemo(() => lessonItems(lesson), [lesson]);
  const [urlParams] = useSearchParams();
  const urlSeed = parseSeed(urlParams.get('seed'));
  const [session, setSession] = useState<LessonSession | null>(null);
  const [pendingResponse, setPendingResponse] = useState<Response | null>(null);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [ownWordsText, setOwnWordsText] = useState('');
  const [ownWordsSubmitted, setOwnWordsSubmitted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [saveNote, setSaveNote] = useState('');
  const savedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    try {
      window.scrollTo(0, 0);
    } catch {
      /* not available (tests) */
    }
    headingRef.current?.focus();
  }, [session?.index, session?.completedAt, session === null]);

  useEffect(() => {
    if (!session || !isComplete(session)) return;
    const key = `${session.seed}:${session.startedAt}`;
    if (savedKey.current === key) return;
    savedKey.current = key;
    persistLessonAttempt(session).then(
      () => setSaveNote('Attempt saved on this device.'),
      () => setSaveNote('This attempt could not be saved on this device.'),
    );
  }, [session]);

  if (!session) {
    return (
      <main className="page page-intro">
        <header className="intro-head">
          <p className="label">
            <Link to="/" className="quiet-link">
              All lessons
            </Link>
          </p>
          <h1 className="wordmark wordmark-lg">STRATEGOS</h1>
        </header>
        <section className="start" aria-labelledby="start-heading">
          <p className="label">Lesson</p>
          <h2 id="start-heading" className="start-title">
            {lesson.workingTitle}
          </h2>
          <p className="intro-lede">{lesson.objective}</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            data-testid="btn-start"
            onClick={() => setSession(startLesson(lesson.id, items, urlSeed ?? freshSeed(), nowIso()))}
          >
            Start
          </button>
        </section>
        <InstallCard />
        <PageFooter />
      </main>
    );
  }

  if (isComplete(session)) {
    return (
      <main className="page page-flow" data-step="reveal">
        <header className="flow-head">
          <p className="wordmark" aria-hidden="true">
            STRATEGOS
          </p>
          <h1 className="flow-title">{lesson.workingTitle}</h1>
        </header>
        <section className="step step-reveal" aria-labelledby="step-heading" data-testid="step-reveal">
          <h2 id="step-heading" tabIndex={-1} ref={headingRef} className="step-heading step-heading-title">
            What this shows
          </h2>
          {lesson.reveal?.body.map((p, i) => (
            <p key={i} className="prose" data-testid="reveal-body">
              {p}
            </p>
          ))}
        </section>
        {saveNote ? (
          <p className="meta" role="status" data-testid="save-note">
            {saveNote}
          </p>
        ) : null}
        <Actions>
          <Link to="/" className="btn btn-primary" data-testid="btn-all-lessons">
            All lessons
          </Link>
        </Actions>
        <PageFooter />
      </main>
    );
  }

  const item = currentItem(session)!;
  const instance = instanceFor(item, `${session.seed}:${item.id}`);
  const concept = PLAY_CONTENT.concepts.find((c) => c.id === item.concept);
  const disclosed = concept ? termAllowed(concept, item.lesson, item.step, LESSON_ORDER) : false;
  const diagnosis: Diagnosis | null = pendingResponse ? diagnose(instance, pendingResponse) : null;
  const feedback = diagnosis ? feedbackFor(instance, diagnosis, PLAY_CONTENT.feedback, instance.id, disclosed) : null;
  const n = session.index + 1;
  const rubric = item.rubric ? PLAY_CONTENT.rubrics.find((r) => r.id === item.rubric) : undefined;

  return (
    <main className="page page-flow" data-step="explain">
      <header className="flow-head">
        <p className="wordmark" aria-hidden="true">
          STRATEGOS
        </p>
        <h1 className="flow-title">{lesson.workingTitle}</h1>
      </header>
      <section className="step step-explain" aria-labelledby="step-heading" data-testid={`item-${item.id}`}>
        <div className="step-indicator">
          <span className="step-num">
            <span aria-hidden="true">
              {pad2(n)} / {pad2(session.items.length)}
            </span>
            <span className="sr-only">
              Item {n} of {session.items.length}
            </span>
          </span>
        </div>
        <p className="prose-lead" data-testid="situation">
          {storyText(instance, 'situation')}
        </p>

        {item.type === 'fill_in' ? (
          <h2 id="step-heading" tabIndex={-1} ref={headingRef} className="step-heading step-heading-question">
            {promptParts(item.prompt).map((part, i) =>
              'text' in part ? (
                <span key={i}>{render(part.text, instance)}</span>
              ) : (
                <input
                  key={i}
                  type="text"
                  className="fill-blank"
                  aria-label={`blank ${part.slot}`}
                  data-testid={`blank-${part.slot}`}
                  value={fillValues[part.slot] ?? ''}
                  disabled={pendingResponse !== null}
                  onChange={(e) => setFillValues((v) => ({ ...v, [part.slot]: e.target.value }))}
                />
              ),
            )}
          </h2>
        ) : (
          <h2 id="step-heading" tabIndex={-1} ref={headingRef} className="step-heading step-heading-question">
            {render(item.prompt, instance)}
          </h2>
        )}

        {item.type === 'reason_choice' ? (
          <div className="choices" role="group" aria-label="Your answer">
            {(item.optionSets?.[0] ?? []).map((opt, i) => (
              <button
                key={i}
                type="button"
                className="choice"
                aria-pressed={pendingResponse?.type === 'reason_choice' && pendingResponse.option === i}
                disabled={pendingResponse !== null}
                onClick={() => setPendingResponse({ type: 'reason_choice', set: 0, option: i })}
              >
                {render(opt.text, instance)}
              </button>
            ))}
          </div>
        ) : null}

        {item.type === 'own_words' ? (
          <textarea
            className="own-words-input"
            data-testid="own-words-input"
            rows={4}
            value={ownWordsText}
            disabled={ownWordsSubmitted}
            onChange={(e) => setOwnWordsText(e.target.value)}
          />
        ) : null}

        {feedback ? (
          <div className={`feedback ${diagnosis!.correct ? 'is-correct' : 'is-miss'}`} role="status" data-testid={`feedback-${item.id}`}>
            <p className="feedback-status">{feedback.status === 'correct' ? '✓ Correct' : 'Not quite'}</p>
            <p className="feedback-headline">{feedback.body}</p>
            {feedback.term ? (
              <p className="feedback-term" data-testid={`term-${item.id}`}>
                {feedback.term}
              </p>
            ) : null}
          </div>
        ) : null}

        {item.type === 'own_words' && ownWordsSubmitted ? (
          <section className="self-check" data-testid="self-check">
            <p className="label">What to check in what you wrote</p>
            <ul className="quiet-list">
              {rubric?.criteria.map((c) => <li key={c.id}>{c.text}</li>)}
            </ul>
          </section>
        ) : null}

        <Actions>
          {item.type === 'fill_in' && pendingResponse === null ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="btn-check"
              disabled={!(item.slots ?? []).every((s) => (fillValues[s.id] ?? '').trim() !== '')}
              onClick={() => setPendingResponse({ type: 'fill_in', values: fillValues })}
            >
              Check
            </button>
          ) : null}
          {(item.type === 'reason_choice' || item.type === 'fill_in') && pendingResponse ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="btn-continue"
              onClick={() => {
                setSession(advance(session, instance, pendingResponse, nowIso()));
                setPendingResponse(null);
                setFillValues({});
              }}
            >
              Continue
            </button>
          ) : null}
          {item.type === 'own_words' && !ownWordsSubmitted ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="btn-submit-words"
              disabled={ownWordsText.trim() === ''}
              onClick={() => setOwnWordsSubmitted(true)}
            >
              Submit
            </button>
          ) : null}
          {item.type === 'own_words' && ownWordsSubmitted ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="btn-continue"
              onClick={() => {
                setSession(advanceSelfAssessed(session, ownWordsText, nowIso()));
                setOwnWordsText('');
                setOwnWordsSubmitted(false);
              }}
            >
              Continue
            </button>
          ) : null}
        </Actions>
      </section>
      <PageFooter />
    </main>
  );
}
