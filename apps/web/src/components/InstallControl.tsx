import { useEffect, useState } from 'react';
import {
  getInstallState,
  isStandalone,
  promptInstall,
  subscribe,
} from '../pwa/installPrompt';

export function InstallControl() {
  const [state, setState] = useState(getInstallState);
  const [standalone, setStandalone] = useState(isStandalone);
  const [note, setNote] = useState('');

  useEffect(() => {
    const unsub = subscribe(() => setState(getInstallState()));
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const onChange = () => setStandalone(isStandalone());
    mq?.addEventListener?.('change', onChange);
    return () => {
      unsub();
      mq?.removeEventListener?.('change', onChange);
    };
  }, []);

  if (standalone) {
    return (
      <p className="install-status" data-testid="standalone-status">
        Running as installed app
      </p>
    );
  }

  if (state.installed) {
    return (
      <p className="install-status" data-testid="installed-status">
        Installed. Open STRATEGOS from your home screen or app drawer.
      </p>
    );
  }

  if (!state.canPrompt) return null;

  return (
    <div className="install-control">
      <button
        type="button"
        className="btn install-btn"
        data-testid="btn-install"
        onClick={async () => {
          const outcome = await promptInstall();
          if (outcome === 'dismissed') setNote('Install dismissed. You can use Chrome’s menu later.');
        }}
      >
        Install STRATEGOS
      </button>
      {note ? <p className="muted small">{note}</p> : null}
    </div>
  );
}
