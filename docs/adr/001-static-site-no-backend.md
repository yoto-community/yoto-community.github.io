# ADR 001: 100% Static Site on GitHub Pages

**Status:** Accepted
**Date:** 2026-11-08
**Deciders:** Project maintainers

## Context

The Awesome Yoto portal is a curated directory of community projects, tools, and resources for the Yoto Player. It must remain trustworthy, fast, and free to operate indefinitely.

## Decision

The portal will be built as a **100% static site** deployed to **GitHub Pages** with **no backend, no database, no server-side runtime, and no third-party analytics**.

All dynamic features (search, filtering, chooser, toolkit, icon editor) run client-side in the browser. Data is generated at build time as static JSON files (`catalog.json`, `projects.json`, `categories.json`, `changelog.json`, `ecosystem.json`).

## Consequences

### Positive
- **Zero operational cost** — GitHub Pages is free for public repos
- **Zero maintenance burden** — no servers, databases, SSL certs, or scaling concerns
- **Inherently secure** — no attack surface from backend code, APIs, or user data
- **Privacy by default** — no analytics, tracking, cookies, or user accounts
- **Fast globally** — served from GitHub's CDN edge network
- **Auditability** — every change is a git commit; the entire site state is reproducible
- **Longevity** — survives maintainer burnout; anyone can fork and redeploy

### Negative
- **No real-time data** — GitHub stars, last commit, link health updated via nightly CI only
- **No user accounts** — favorites/toolkit stored in `localStorage` only (same-origin)
- **No server-side personalization** — all i18n routing is URL-based (`/fr/`)
- **Build-time only integrations** — external catalogues (icons, podcasts) synced via scheduled scripts

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Netlify/Vercel with serverless functions | Adds vendor dependency; functions = hidden backend |
| Self-hosted VPS + database | Operational cost, maintenance, security surface |
| Client-side only with live GitHub API calls | Rate limits, CORS, slower UX, fails offline |
| Adding a simple backend for "favorites sync" | Violates "no account" promise; adds auth complexity |

## Enforcement

- CI (`pnpm check:budget`) enforces JS bundle < 30 KB gzip
- `pnpm verify` runs full build + all checks before deploy
- `.github/workflows/pages.yml` only runs `pnpm build` → static `site/dist/`
- No `server/`, `api/`, or `functions/` directories allowed in repo

## References

- [Roadmap constraint: "100% statique, GitHub Pages, aucun backend"](https://github.com/yoto-community/yoto-community.github.io/blob/main/docs/roadmap.md#L7-L8)
- [GitHub Pages deployment](https://github.com/yoto-community/yoto-community.github.io/blob/main/.github/workflows/pages.yml)