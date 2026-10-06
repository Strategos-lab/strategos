import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Periodic check when the tab is visible (quiet; never auto-activates).
      if (registration) {
        setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="update-banner" role="status" data-testid="update-banner">
      <span>Update available — Reload when ready (won&apos;t interrupt a session).</span>
      <div className="update-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => void updateServiceWorker(true)}
        >
          Reload
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
