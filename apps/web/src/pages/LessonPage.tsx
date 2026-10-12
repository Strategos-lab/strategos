import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PLAY_CONTENT, diagnose, feedbackFor, render, storyText, type Diagnosis, type Item, type Lesson, type Response } from '@strategos/content/play';
import { InstallCard } from '../components/InstallCard';
import { freshSeed, instanceFor, parseSeed } from '../lesson/lessonInstances';
import { advance, currentItem, isComplete, startLesson, type LessonSession } from '../lesson/lessonSession';
import { persistLessonAttempt } from '../lesson/lessonAttemptRecord';

const nowIso = () => new Date().toISOString();
const pad2 = (n: number) => String(n).padStart(2, '0');

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

function Footer() {
  return (
    <footer className="page-foot">
      <Link to="/data" className="quiet-link">
        Data &amp; app
      </Link>
    </footer>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="actions">{children}</div>;
}

/**
 * First Phase 3 increment: plays one lesson (`m1.l1` by default) end to end, item by item, driven
 * entirely by `@strategos/content`'s generic Item/Instance model — distinct from the roommate
 * slice (`SlicePage.tsx`), which models one fixed predict/decide/reveal encounter.
 */
export function LessonPage({ lessonId }: { lessonId: string }) {
  const lesson = useMemo(() => findLesson(lessonId), [lessonId]);
  const items = useMemo(() => lessonItems(lesson), [lesson]);
  const [params] = useSearchParams();
  const urlSeed = parseSeed(params.get('seed'));
  const [session, setSession] = useState<LessonSession | null>(null);
  const [pendingResponse, setPendingResponse] = useState<Response | null>(null);
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
          <p className="label">Strategic thinking laboratory</p>
          <h1 className="wordmark wordmark-lg">STRATEGOS</h1>
          <p className="intro-lede">{lesson.objective}</p>
        </header>
        <section className="start" aria-labelledby="start-heading">
          <p className="label">First lesson</p>
          <h2 id="start-heading" className="start-title">
            {lesson.workingTitle}
          </h2>
          <button
            type="button"
            className="btn btn-primary btn-block"
            data-testid="btn-start"
            onClick={() => {
              setSession(startLesson(lesson.id, items, urlSeed ?? freshSeed(), nowIso()));
              setPendingResponse(null);
            }}
          >
            Start
          </button>
        </section>
        <InstallCard />
        <Footer />
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
        <Footer />
      </main>
    );
  }

  const item = currentItem(session)!;
  const optionSet = item.optionSets?.[0] ?? [];
  const instance = instanceFor(item, `${session.seed}:${item.id}`);
  const diagnosis: Diagnosis | null = pendingResponse ? diagnose(instance, pendingResponse) : null;
  const feedback = diagnosis ? feedbackFor(instance, diagnosis, PLAY_CONTENT.feedback, instance.id, false) : null;
  const n = session.index + 1;

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
        <h2 id="step-heading" tabIndex={-1} ref={headingRef} className="step-heading step-heading-question">
          {render(item.prompt, instance)}
        </h2>
        <div className="choices" role="group" aria-label="Your answer">
          {optionSet.map((opt, i) => (
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
        {feedback ? (
          <div className={`feedback ${diagnosis!.correct ? 'is-correct' : 'is-miss'}`} role="status" data-testid={`feedback-${item.id}`}>
            <p className="feedback-status">{feedback.status === 'correct' ? '✓ Correct' : 'Not quite'}</p>
            <p className="feedback-headline">{feedback.body}</p>
          </div>
        ) : null}
        <Actions>
          {pendingResponse ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="btn-continue"
              onClick={() => {
                setSession(advance(session, instance, pendingResponse, nowIso()));
                setPendingResponse(null);
              }}
            >
              Continue
            </button>
          ) : null}
        </Actions>
      </section>
      <Footer />
    </main>
  );
}
