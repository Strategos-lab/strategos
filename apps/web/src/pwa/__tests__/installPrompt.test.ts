import { describe, expect, it, vi } from 'vitest';
import { getInstallState, promptInstall, subscribe } from '../installPrompt';

function fakePromptEvent(outcome: 'accepted' | 'dismissed') {
  const ev = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  ev.prompt = vi.fn().mockResolvedValue(undefined);
  ev.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return ev;
}

describe('install prompt capture', () => {
  it('stashes beforeinstallprompt, prevents default, and prompts once', async () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    const ev = fakePromptEvent('accepted');
    window.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(getInstallState().canPrompt).toBe(true);
    expect(listener).toHaveBeenCalled();

    await expect(promptInstall()).resolves.toBe('accepted');
    expect(ev.prompt).toHaveBeenCalledTimes(1);
    expect(getInstallState().canPrompt).toBe(false);
    await expect(promptInstall()).resolves.toBe('unavailable');
    unsub();
  });

  it('marks installed after appinstalled', () => {
    window.dispatchEvent(fakePromptEvent('accepted'));
    window.dispatchEvent(new Event('appinstalled'));
    expect(getInstallState()).toEqual({ canPrompt: false, installed: true });
  });
});
