import { Link } from 'react-router-dom';
import { StoragePanel } from '../components/StoragePanel';
import { InstallHelp } from '../components/InstallHelp';

/** Small settings/data page: export, import, erase. Reached from an unobtrusive footer link. */
export function DataPage() {
  return (
    <main className="home">
      <header className="hero">
        <p className="eyebrow">STRATEGOS</p>
        <h1>Data &amp; app</h1>
      </header>
      <StoragePanel />
      <InstallHelp />
      <footer className="site-footer">
        <p className="small">
          <Link to="/">Back</Link>
        </p>
      </footer>
    </main>
  );
}
