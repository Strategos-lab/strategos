import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PayoffMatrix, type CellCoord } from '../components/PayoffMatrix';
import { ConfidenceControl } from '../components/ConfidenceControl';
import { StoragePanel } from '../components/StoragePanel';
import { EngineDebug } from '../components/EngineDebug';

/**
 * Developer mode (#/dev): the Phase 0/1 spike — tap-to-select matrix, engine debug output and the
 * storage panel with sample-event tools. Not linked from the learner experience.
 */
const DEMO_PAYOFFS: [number, number][][] = [
  [
    [3, 3],
    [0, 5],
  ],
  [
    [5, 0],
    [1, 1],
  ],
];

export function DevPage() {
  const [selected, setSelected] = useState<CellCoord | null>(null);
  const [confidence, setConfidence] = useState(70);
  const [showEngine, setShowEngine] = useState(false);

  return (
    <main className="home">
      <header className="hero">
        <p className="eyebrow">Developer mode</p>
        <h1>STRATEGOS</h1>
        <p className="lede">Phase 0 stub and engine probes. Not part of the learner experience.</p>
      </header>

      <PayoffMatrix
        rowPlayerLabel="You (roommate A)"
        colPlayerLabel="Roommate B"
        rowActions={['Clean', 'Leave it']}
        colActions={['Clean', 'Leave it']}
        payoffs={DEMO_PAYOFFS}
        selected={selected}
        onSelect={setSelected}
        demoNote="Demo only: roommates deciding whether to clean a shared kitchen. Numbers are illustrative — concepts are not taught yet."
      />

      <label className="debug-toggle muted small">
        <input
          type="checkbox"
          checked={showEngine}
          onChange={(e) => setShowEngine(e.target.checked)}
          data-testid="engine-debug-toggle"
        />{' '}
        Debug: show engine output
      </label>
      {showEngine ? (
        <EngineDebug rowActions={['Clean', 'Leave it']} colActions={['Clean', 'Leave it']} payoffs={DEMO_PAYOFFS} />
      ) : null}

      <ConfidenceControl value={confidence} onChange={setConfidence} label="Prediction confidence (stub)" />

      <StoragePanel devTools />

      <footer className="site-footer">
        <p className="muted small">
          <Link to="/">Back to the app</Link>
        </p>
      </footer>
    </main>
  );
}
