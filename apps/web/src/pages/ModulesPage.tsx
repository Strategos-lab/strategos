import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PLAY_CONTENT } from '@strategos/content/play';
import { InstallCard } from '../components/InstallCard';
import { PageFooter } from '../components/PageFooter';
import { loadLessonProgress, missingPrerequisites, nextLesson, type LessonProgress } from '../lesson/lessonProgress';

/** Lessons the lesson player cannot run yet, with why. Empty for now — kept for future use. */
const UNAVAILABLE: Record<string, string> = {};

const EMPTY_PROGRESS: LessonProgress = { completed: new Set(), ready: new Set() };

/**
 * Landing page: what the app is for, the recommended cadence, a "Continue" entry point into the
 * next ready lesson, and every lesson across all modules. Readiness/completion are read from
 * what's already recorded on this device (see lessonProgress.ts) — nothing here is enforced; every
 * lesson stays a plain link regardless of its state.
 */
export function ModulesPage() {
  const [progress, setProgress] = useState<LessonProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    let cancelled = false;
    loadLessonProgress().then((p) => {
      if (!cancelled) setProgress(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const next = nextLesson(progress);

  return (
    <main className="page page-intro">
      <header className="intro-head">
        <p className="label">Strategic thinking laboratory</p>
        <h1 className="wordmark wordmark-lg">STRATEGOS</h1>
        <p className="intro-lede">
          Short exercises in reading a situation before reacting to it: who is actually deciding, what their
          real options are, and what each side knows.
        </p>
        <p className="meta" data-testid="intro-cadence">
          A few exercises a day, most days, builds this habit faster than one long session.
        </p>
      </header>

      {next ? (
        <section className="start" aria-labelledby="continue-heading">
          <p className="label">{progress.completed.size > 0 ? 'Continue' : 'Start here'}</p>
          <h2 id="continue-heading" className="start-title">
            {next.workingTitle}
          </h2>
          <Link className="btn btn-primary btn-block" to={`/lesson/${next.id}`} data-testid="btn-continue-lesson">
            {progress.completed.size > 0 ? 'Continue' : 'Start'}
          </Link>
        </section>
      ) : null}

      <InstallCard />

      {PLAY_CONTENT.curriculum.modules.map((m) => (
        <section key={m.id} className="start" aria-labelledby={`module-heading-${m.id}`}>
          <p className="label">Module {m.number}</p>
          <h2 id={`module-heading-${m.id}`} className="start-title">
            {m.workingTitle}
          </h2>
          <ul className="quiet-list" data-testid={`module-${m.id}-lessons`}>
            {m.lessons.map((l) => {
              const blocked = UNAVAILABLE[l.id];
              if (blocked) {
                return (
                  <li key={l.id}>
                    <span className="meta" data-testid={`lesson-${l.id}-blocked`}>
                      {l.workingTitle} — {blocked}
                    </span>
                  </li>
                );
              }
              const isDone = progress.completed.has(l.id);
              const missing = isDone ? [] : missingPrerequisites(l, progress.completed);
              return (
                <li key={l.id}>
                  <Link
                    className={missing.length > 0 ? 'btn btn-quiet dim' : 'btn btn-quiet'}
                    to={`/lesson/${l.id}`}
                    data-testid={`lesson-${l.id}`}
                  >
                    {l.workingTitle}
                  </Link>
                  {isDone ? (
                    <span className="meta" data-testid={`lesson-${l.id}-done`}>
                      {' '}
                      Completed
                    </span>
                  ) : missing.length > 0 ? (
                    <span className="meta" data-testid={`lesson-${l.id}-needs`}>
                      {' '}
                      Complete {missing.map((p) => `"${p.workingTitle}"`).join(', ')} first
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <PageFooter />
    </main>
  );
}
