# STRATEGOS

Strategic decision laboratory — a **static, installable PWA** for learning to think strategically. Device-only storage. No accounts, no backend, no AI, no analytics.

**Live (GitHub Pages):** https://Wangden-Bhutia.github.io/strategos/

## Phase status

**Phase 0** — decisions, Pages deploy, PWA shell, IndexedDB spike, design-language prototype.  
Later phases (engine, modules, mastery, lab, worksheet) are not started.

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

Target (plan): keep Phase 0 lean; full V1 shell ≤ ~200 KB JS compressed.  
See `docs/phase0.md` and the latest CI summary for **measured** sizes after each deploy.

## Install (PWA)

### Android (Chrome)

1. Open https://Wangden-Bhutia.github.io/strategos/
2. Browser menu → **Install app** / **Add to Home screen**, or use the install prompt if shown.
3. Prefer the installed icon for day-to-day use.

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
