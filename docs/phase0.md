# Phase 0 — decisions and spikes

## Pages URL

https://Wangden-Bhutia.github.io/strategos/

Hash routes look like `https://Wangden-Bhutia.github.io/strategos/#/`.

## Storage origin assumptions

Browser storage (IndexedDB, Cache Storage, localStorage) is keyed by **origin** = scheme + host + port.

- All GitHub Pages project sites under the same username share one origin: `https://Wangden-Bhutia.github.io`.
- Database names are **namespaced** (`strategos-v1-learning`, `strategos-v1-worksheet`) to reduce accidental collision with other apps’ keys.
- Namespacing does **not** isolate against a malicious script on another Pages site on the same account: same-origin scripts can open any IndexedDB on that origin.
- **Recommendation:** do not host untrusted or third-party Pages sites on the same GitHub account as STRATEGOS. A custom domain later would change the origin (export first).

## iOS Safari eviction and separate storage

- Safari may evict script-writable storage for sites unused for a period of browser use (tracking-prevention policy). Retention is not guaranteed.
- Home Screen web apps are treated differently from Safari tabs, but eviction is still possible under storage pressure.
- **Safari tab vs Home Screen may be separate storage.** Data written in one may not appear in the other.
- Phase 0 requests `navigator.storage.persist()` and shows the result in the UI. Granting persistence helps but is not a guarantee on iOS.
- **Export learning JSON regularly.** Import (replace in Phase 0; merge later) is the recovery path.

## What Phase 0 verified automatically

| Check | How |
|---|---|
| TypeScript build | `pnpm typecheck` / `pnpm build` in CI |
| IndexedDB write / read / export / import-replace / erase | Vitest + fake-indexeddb |
| Persist helper (supported / granted paths) | Vitest mocks |
| Matrix loads, hash route, cell select, confidence, sample event, export download | Playwright Chromium + WebKit, mobile viewports |
| Deploy to Pages via Actions | `actions/deploy-pages` on `main` |

## What you must check on devices

### Android

- [ ] Open live Pages URL in Chrome.
- [ ] Install to Home Screen; reopen offline (airplane mode) after first load.
- [ ] Write sample event → export → erase → import → events restored.
- [ ] Request persistent storage; note the status line.
- [ ] Matrix and confidence control usable on a narrow phone screen.

### iPhone

- [ ] Open in Safari; dismissible “Install on iPhone” card appears (Share → Add to Home Screen).
- [ ] Add to Home Screen; confirm standalone (no Safari chrome).
- [ ] Confirm storage separation: write an event in Safari tab, open Home Screen app — may be empty (expected).
- [ ] Prefer the installed app; export a backup from it.
- [ ] After a first online load, confirm shell works offline.
- [ ] When a new deploy ships, confirm the update banner appears and Reload is opt-in (not silent).

## Demo content note

The 2×2 matrix uses a roommates / shared-kitchen story with classic PD numbers **as a visual demo only**. Phase 0 does not teach Prisoner's Dilemma or any module content.

## Out of scope (do not expect yet)

Game engine solvers, mastery, modules, lab, worksheet logic, merge-on-import, AI.
