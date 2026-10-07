import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function setUa(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function fakePromptEvent(outcome: 'accepted' | 'dismissed') {
  const ev = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  ev.prompt = vi.fn().mockResolvedValue(undefined);
  ev.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return ev;
}

/** Fresh module state (captured prompt / installed flag) for each test. */
async function renderCard() {
  vi.resetModules();
  const { InstallCard } = await import('../InstallCard');
  render(<InstallCard />);
}

describe('InstallCard', () => {
  beforeEach(() => {
    localStorage.clear();
    setUa(DESKTOP_UA);
  });
  afterEach(() => cleanup());

  it('renders nothing when no install path exists (desktop Firefox)', async () => {
    await renderCard();
    expect(screen.queryByTestId('install-card')).toBeNull();
  });

  it('shows on beforeinstallprompt and calls prompt()', async () => {
    await renderCard();
    const ev = fakePromptEvent('accepted');
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(screen.getByRole('heading', { name: 'Install STRATEGOS' })).toBeInTheDocument();
    expect(
      screen.getByText('Add it to your home screen for full-screen, offline practice.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(ev.prompt).toHaveBeenCalledTimes(1);
  });

  it('hides after appinstalled', async () => {
    await renderCard();
    act(() => {
      window.dispatchEvent(fakePromptEvent('dismissed'));
    });
    expect(screen.getByTestId('install-card')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByTestId('install-card')).toBeNull();
    expect(screen.getByTestId('installed-status')).toBeInTheDocument();
  });

  it('on iOS, Install app expands Share → Add to Home Screen steps', async () => {
    setUa(IPHONE_UA);
    await renderCard();
    const btn = screen.getByRole('button', { name: 'Install app' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('ios-install-steps')).toHaveTextContent('Add to Home Screen');
  });

  it('dismiss stores the namespaced timestamp and hides the card', async () => {
    setUa(IPHONE_UA);
    await renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss install card' }));
    expect(screen.queryByTestId('install-card')).toBeNull();
    expect(Number(localStorage.getItem('strategos:v1:installCardDismissedAt'))).toBeGreaterThan(0);
    cleanup();
    await renderCard();
    expect(screen.queryByTestId('install-card')).toBeNull();
  });

  it('reappears after 14 days', async () => {
    setUa(IPHONE_UA);
    localStorage.setItem(
      'strategos:v1:installCardDismissedAt',
      String(Date.now() - 15 * 24 * 60 * 60 * 1000),
    );
    await renderCard();
    expect(screen.getByTestId('install-card')).toBeInTheDocument();
  });

  it('hides when running standalone', async () => {
    setUa(IPHONE_UA);
    const orig = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q === '(display-mode: standalone)',
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      await renderCard();
      expect(screen.queryByTestId('install-card')).toBeNull();
      expect(screen.getByTestId('standalone-status')).toBeInTheDocument();
    } finally {
      window.matchMedia = orig;
    }
  });
});
