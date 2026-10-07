import { useState } from 'react';
import { PayoffMatrix, type CellCoord } from '../components/PayoffMatrix';
import { ConfidenceControl } from '../components/ConfidenceControl';
import { StoragePanel } from '../components/StoragePanel';
import { InstallCard } from '../components/InstallCard';
import { InstallHelp } from '../components/InstallHelp';

/** Classic PD numbers, labelled only as a demo — do not teach PD yet. */
const DEMO_PAYOFFS: [
  [[number, number], [number, number]],
  [[number, number], [number, number]],
] = [
  [
    [3, 3],
    [0, 5],
  ],
  [
    [5, 0],
    [1, 1],
  ],
];

export function HomePage() {
  const [selected, setSelected] = useState<CellCoord | null>(null);
  const [confidence, setConfidence] = useState(70);

  return (
    <main className="home">
      <header className="hero">
        <p className="eyebrow">Phase 0 spike</p>
        <h1>STRATEGOS</h1>
        <p className="lede">
          Strategic decision laboratory. Device-only. Offline after first load. No
          accounts, no cloud, no AI.
        </p>
      </header>

      <InstallCard />

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

      <ConfidenceControl value={confidence} onChange={setConfidence} />

      <StoragePanel />

      <InstallHelp />

      <footer className="site-footer">
        <p className="muted small">
          Live at{' '}
          <a href="https://strategos-lab.github.io/strategos/">
            strategos-lab.github.io/strategos
          </a>
          . Hash routes: <code>#/</code>
        </p>
      </footer>
    </main>
  );
}
