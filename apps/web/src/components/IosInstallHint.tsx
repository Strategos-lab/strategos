import { useEffect, useState } from 'react';

const STORAGE_KEY = 'strategos-ios-install-dismissed';

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari legacy
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return mq || nav.standalone === true;
}

export function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <aside className="ios-hint" data-testid="ios-install-hint">
      <button
        type="button"
        className="ios-hint-dismiss"
        aria-label="Dismiss install hint"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, '1');
          setVisible(false);
        }}
      >
        ×
      </button>
      <h2>Install on iPhone</h2>
      <ol>
        <li>
          Tap the <strong>Share</strong> button in Safari.
        </li>
        <li>
          Choose <strong>Add to Home Screen</strong>.
        </li>
        <li>Open STRATEGOS from your Home Screen for the installed experience.</li>
      </ol>
      <p className="muted small">
        Safari tabs and the Home Screen app may keep separate storage. Prefer the
        installed app for your learning record.
      </p>
    </aside>
  );
}
