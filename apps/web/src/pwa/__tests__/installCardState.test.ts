import { afterEach, describe, expect, it } from 'vitest';
import {
  INSTALL_CARD_DISMISSED_KEY,
  INSTALL_CARD_SNOOZE_MS,
  dismissInstallCard,
  isInstallCardDismissed,
} from '../installCardState';

describe('install card dismissal', () => {
  afterEach(() => localStorage.clear());

  it('uses the namespaced key', () => {
    expect(INSTALL_CARD_DISMISSED_KEY).toBe('strategos:v1:installCardDismissedAt');
    dismissInstallCard(1000);
    expect(localStorage.getItem(INSTALL_CARD_DISMISSED_KEY)).toBe('1000');
  });

  it('is not dismissed by default or with a corrupt value', () => {
    expect(isInstallCardDismissed()).toBe(false);
    localStorage.setItem(INSTALL_CARD_DISMISSED_KEY, 'garbage');
    expect(isInstallCardDismissed()).toBe(false);
  });

  it('stays dismissed for 14 days, then reappears', () => {
    const t0 = 1_700_000_000_000;
    dismissInstallCard(t0);
    expect(isInstallCardDismissed(t0 + INSTALL_CARD_SNOOZE_MS - 1)).toBe(true);
    expect(isInstallCardDismissed(t0 + INSTALL_CARD_SNOOZE_MS)).toBe(false);
  });

  it('clears the legacy iOS hint key', () => {
    localStorage.setItem('strategos-ios-install-dismissed', '1');
    isInstallCardDismissed();
    expect(localStorage.getItem('strategos-ios-install-dismissed')).toBeNull();
  });
});
