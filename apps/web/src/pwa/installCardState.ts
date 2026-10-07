/**
 * Install-card platform detection and dismissal persistence.
 * Dismissal is stored under a STRATEGOS-namespaced key and expires after 14 days.
 */
export const INSTALL_CARD_DISMISSED_KEY = 'strategos:v1:installCardDismissedAt';
export const INSTALL_CARD_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/** Legacy key from the old IosInstallHint; cleared so it never lingers. */
const LEGACY_IOS_HINT_KEY = 'strategos-ios-install-dismissed';

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function isInstallCardDismissed(now: number = Date.now()): boolean {
  try {
    localStorage.removeItem(LEGACY_IOS_HINT_KEY);
    const raw = localStorage.getItem(INSTALL_CARD_DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return now - at < INSTALL_CARD_SNOOZE_MS;
  } catch {
    return false;
  }
}

export function dismissInstallCard(now: number = Date.now()): void {
  try {
    localStorage.setItem(INSTALL_CARD_DISMISSED_KEY, String(now));
  } catch {
    // Storage unavailable (private mode); dismissal lasts for this session only.
  }
}
