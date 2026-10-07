import { useEffect, useId, useState } from 'react';
import {
  getInstallState,
  isStandalone,
  promptInstall,
  subscribe,
} from '../pwa/installPrompt';
import { dismissInstallCard, isInstallCardDismissed, isIos } from '../pwa/installCardState';

/**
 * Prominent, dismissible install card.
 * - Chromium/Android: shown once `beforeinstallprompt` is captured; button prompts.
 * - iOS (not standalone): button reveals Share → Add to Home Screen steps.
 * - Hidden when standalone, after `appinstalled`, when dismissed (14 days), or
 *   when no install path exists (e.g. desktop Firefox).
 */
export function InstallCard() {
  const [state, setState] = useState(getInstallState);
  const [standalone, setStandalone] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => isInstallCardDismissed());
  const [ios] = useState(isIos);
  const [showSteps, setShowSteps] = useState(false);
  const [note, setNote] = useState('');
  const titleId = useId();
  const stepsId = useId();

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

  const canInstall = state.canPrompt || ios;
  if (!canInstall || dismissed) return null;

  const onInstall = async () => {
    if (state.canPrompt) {
      const outcome = await promptInstall();
      if (outcome === 'dismissed') setNote('Install dismissed. You can use the browser menu later.');
      return;
    }
    setShowSteps((v) => !v);
  };

  return (
    <section className="install-card" aria-labelledby={titleId} data-testid="install-card">
      <div className="install-card-head">
        <img
          className="install-card-icon"
          src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
          alt=""
          width={48}
          height={48}
        />
        <div className="install-card-text">
          <h2 id={titleId}>Install STRATEGOS</h2>
          <p>Add it to your home screen for full-screen, offline practice.</p>
        </div>
        <button
          type="button"
          className="install-card-close"
          aria-label="Dismiss install card"
          data-testid="install-card-dismiss"
          onClick={() => {
            dismissInstallCard();
            setDismissed(true);
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <button
        type="button"
        className="btn primary install-card-cta"
        data-testid="btn-install"
        aria-expanded={state.canPrompt ? undefined : showSteps}
        aria-controls={state.canPrompt ? undefined : stepsId}
        onClick={() => void onInstall()}
      >
        Install app
      </button>

      {!state.canPrompt && showSteps ? (
        <div id={stepsId} className="install-card-steps" data-testid="ios-install-steps">
          <ol>
            <li>
              Tap the <strong>Share</strong> button in Safari.
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>.
            </li>
            <li>Open STRATEGOS from your Home Screen.</li>
          </ol>
          <p className="muted small">
            Safari tabs and the Home Screen app may keep separate storage. Prefer the
            installed app for your learning record.
          </p>
        </div>
      ) : null}

      {note ? (
        <p className="muted small install-card-note" role="status">
          {note}
        </p>
      ) : null}
    </section>
  );
}
