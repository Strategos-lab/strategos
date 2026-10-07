import { Link } from 'react-router-dom';
import { StoragePanel } from '../components/StoragePanel';
import { InstallHelp } from '../components/InstallHelp';

/** Small settings/data page: export, import, erase. Reached from an unobtrusive footer link. */
export function DataPage() {
  return (
    <main className="page page-data">
      <header className="flow-head">
        <p className="wordmark">STRATEGOS</p>
      </header>
      <h1 className="step-heading-title">Data &amp; app</h1>
      <StoragePanel />
      <InstallHelp />
      <footer className="page-foot">
        <Link to="/" className="quiet-link">
          Back
        </Link>
      </footer>
    </main>
  );
}
