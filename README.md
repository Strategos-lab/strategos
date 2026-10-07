# STRATEGOS

Strategic decision laboratory — a **static, installable PWA** for learning to think strategically. Device-only storage. No accounts, no backend, no AI, no analytics.

**Live (GitHub Pages):** https://strategos-lab.github.io/strategos/

**Production Rules:** read [`docs/STRATEGOS_PRODUCTION_RULES.md`](docs/STRATEGOS_PRODUCTION_RULES.md) before every task. It is the operational contract for look, behaviour, teaching and implementation, alongside the V1 Plan.

## Status

- **Phase 0** — decisions, Pages deploy, PWA shell, IndexedDB spike, design-language prototype ([`docs/phase0.md`](docs/phase0.md)).
- **Phase 1** — exact game-theory engine `@strategos/engine` ([`docs/phase1.md`](docs/phase1.md)).
- **Learner slice** — the first learner-facing experience: one complete roommate / shared-kitchen
  encounter (situation → predict → confidence → decide → B’s response → outcome in words → matrix
  reveal → engine-checked reasoning questions → summary separating decision quality from outcome).
  Content is data-driven and validated; every game fact comes from the engine; B’s choice comes from a
  declared seeded policy (Leave it 7/10, Clean 3/10). See [`docs/slice-roommate.md`](docs/slice-roommate.md).

Routes: `#/` learner slice, `#/data` export / import / erase, `#/dev` developer mode (old spike,
engine debug output; not linked from the learner UI). Modules, mastery, lab and worksheet are not started.

## Stack decision (Phase 0)

| Choice | Decision |
|---|---|
| Monorepo | **pnpm workspaces** — `apps/web` (this PWA) + `packages/*` placeholders (`packages/engine` reserved for Phase 1) |
| UI | React 19 + TypeScript + Vite 8 |
| Router | **HashRouter** (`#/`) — no SPA rewrite hacks on GitHub Pages |
| Base path | `base: '/strategos/'` |
| PWA | `vite-plugin-pwa` + Workbox; `registerType: 'prompt'` |
| Update strategy | Banner: “Update available — Reload”; never silent mid-session |
| Storage | Dexie / IndexedDB: `strategos-v1-learning` and `strategos-v1-worksheet` (separate DBs) |
| Tests | Vitest (storage) + Playwright (Chromium + WebKit, mobile viewports) |

## Develop

```bash
pnpm install
pnpm dev          # Vite at http://localhost:5173/strategos/
pnpm test         # Vitest
pnpm build        # apps/web/dist
pnpm test:e2e     # Playwright (builds + preview)
```

## Bundle budget

Target (plan): app shell ≤ ~200 KB JS compressed.  
**Measured (local production build, no source maps; updated with the v2 visual design):**

| Asset | Raw | Gzip |
|---|---:|---:|
| Main JS (`index-*.js`) | ~427 KB | ~136 KB |
| CSS | ~23 KB | ~4.9 KB |
| Fonts (Inter + JetBrains Mono, latin, variable woff2; separate assets) | ~87 KB | (already compressed) |
| Precache (service worker) | ~565 KB | — |

Within the Phase 0 / V1 shell budget. See CI job summary on each deploy for the latest figures.

## Install (PWA)

### Android (Chrome)

1. Open https://strategos-lab.github.io/strategos/
2. Browser menu → **Install app** / **Add to Home screen**, or use the install prompt if shown.
3. Prefer the installed icon for day-to-day use.

### Android troubleshooting: “already installed” but no icon

1. Look in the **app drawer** (swipe up). Chrome often installs the app there without a home-screen icon; long-press → *Add to Home screen*.
2. Otherwise open **Settings → Apps**, find **STRATEGOS** (a stale copy) and **Uninstall** it. Export learning data first if the installed copy holds any.
3. Back in Chrome, reload the page and tap **Install app** on the in-app install card or Chrome menu ⋮ → **Install app**.

The manifest has a stable `id: "/strategos/"` (with `start_url` and `scope` both `/strategos/`). The app is hosted under the dedicated `Strategos-lab` organisation, so its origin `https://strategos-lab.github.io` is not shared with any other app. Never change the `id` once installed.

To check installability from a desktop: `node apps/web/scripts/check-installability.mjs` (headless Chromium, CDP `Page.getInstallabilityErrors`).

### iPhone (Safari)

1. Open the URL in **Safari** (not an in-app browser).
2. Tap **Share** → **Add to Home Screen**.
3. Open from the Home Screen. Safari tabs and the Home Screen app may keep **separate** storage — use the installed app for your learning record.

Details and storage caveats: [`docs/phase0.md`](docs/phase0.md).

## Privacy / data

- Learning events live only in IndexedDB on your device (`strategos-v1-learning`).
- Worksheet store (`strategos-v1-worksheet`) is a stub in Phase 0 and is **excluded** from learning export.
- Never commit learning records, worksheets, backups, or personal data to this repository.

## License

Private use by the repository owner for now; content and code are public because GitHub Pages on a free account requires a public repo.
