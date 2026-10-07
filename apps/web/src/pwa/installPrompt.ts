/**
 * Captures Chromium's `beforeinstallprompt` as early as possible (imported from
 * main.tsx before React mounts) so the event is never missed.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type Listener = () => void;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches === true ||
    nav.standalone === true
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInstallState(): { canPrompt: boolean; installed: boolean } {
  return { canPrompt: deferred !== null, installed };
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const ev = deferred;
  if (!ev) return 'unavailable';
  deferred = null; // the event can only be used once
  emit();
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  return outcome;
}
