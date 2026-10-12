import { Link } from 'react-router-dom';
import { PLAY_CONTENT } from '@strategos/content/play';
import { PageFooter } from '../components/PageFooter';

/** Lessons the generic lesson player cannot run yet, with why. */
const UNAVAILABLE: Record<string, string> = {
  'm3.l1': 'Not yet available on this device — this lesson uses the roommate scenario.',
};

/** Landing page: what the app is for, the recommended cadence, and every lesson across all modules. */
export function ModulesPage() {
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
      {PLAY_CONTENT.curriculum.modules.map((m) => (
        <section key={m.id} className="start" aria-labelledby={`module-heading-${m.id}`}>
          <p className="label">Module {m.number}</p>
          <h2 id={`module-heading-${m.id}`} className="start-title">
            {m.workingTitle}
          </h2>
          <ul className="quiet-list" data-testid={`module-${m.id}-lessons`}>
            {m.lessons.map((l) => {
              const blocked = UNAVAILABLE[l.id];
              return (
                <li key={l.id}>
                  {blocked ? (
                    <span className="meta" data-testid={`lesson-${l.id}-blocked`}>
                      {l.workingTitle} — {blocked}
                    </span>
                  ) : (
                    <Link className="btn btn-quiet" to={`/lesson/${l.id}`} data-testid={`lesson-${l.id}`}>
                      {l.workingTitle}
                    </Link>
                  )}
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
