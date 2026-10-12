import { Link } from 'react-router-dom';

export function PageFooter() {
  return (
    <footer className="page-foot">
      <Link to="/data" className="quiet-link">
        Data &amp; app
      </Link>
    </footer>
  );
}
