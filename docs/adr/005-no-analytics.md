# ADR 005: Privacy-First — No Analytics, Search Console Only

**Status:** Accepted
**Date:** 2026-11-08
**Deciders:** Project maintainers

## Context

The Awesome Yoto portal is a community-driven, privacy-respecting resource. It makes specific commitments about data collection, which must be upheld in every feature addition.

## Decision

**Zero third-party analytics.** The portal does not use Google Analytics, Plausible, Fathom, Cloudflare Analytics, or any other embedded analytics service.

### What IS Tracked (and How)

| Metric | Source | Privacy Treatment |
|--------|--------|--------------------|
| **Search Console** | Google Search Console (webmaster tools) | Public data; shows impressions/clicks for indexed URLs; no user-level data |
| **GitHub** | GitHub repo insights | Public stats: stars, forks, PRs merged per month; issue counts; no private data |
| **Lighthouse CI** | GitHub Actions + Pagefind | Accessibility ≥ 95, JS budget < 30 Ko, SEO score; no visitor data |
| **Manual user testing** | 5–6 user testers (non-technical parents, auto-hobbyists, developers) | Audio-recorded sessions; data never leaves testers' devices; transcripts stored anonymously |

### What is NOT Collected
- No IP addresses
- No cookies beyond GitHub Pages session cookie (necessary, not tracked)
- No user IDs, no account creation
- No session replay, no heatmaps, no scroll depth
- No feature usage funnel, no conversion tracking
- No A/B testing

### Why This Matters

1. **Trust signal** — parents and educators expect privacy from children's tool ecosystems
2. **Compliance** — COPPA-adjacent; no child data collected intentionally
3. **Longevity** — no vendor lock-in, no API changes, no cost creep
4. **Simplicity** — one less thing to maintain, update, or GDPR-review
5. **Philosophy** — "awesome" lists should be useful without surveillance

### Search Console SEO Metrics (Acceptable)

We do track aggregate SEO health through Search Console because:
- **Impressions & clicks** on `/chooser/`, `/guides/*`, `/tags/*`, `/alternatives/*` for queries like "convert youtube to yoto card"
- **Keyword visibility** — ensures our long-tail content is discoverable
- **No personal data** — Search Console shows only aggregate, anonymized data about how people find the site via search engines
- **Gate in roadmap** — "confirmation qu'on reste à zéro" (see Roadmap §8); if Search Console data ever reveals personally identifiable patterns, we will cease

### Search Console Setup

- Property: `https://yoto-community.github.io/` (primary) and `https://yoto-community.github.io/fr/` (alternate)
- Verified via GitHub repo ownership
- Only read-access; no data is written back
- Data retention: 16 months (Google's default), after which it ages out

### Enforcement

- `pnpm check:budget` enforces JS < 30 KB gzip (no analytics scripts possible)
- CI `.github/workflows/pages.yml` runs full `pnpm verify` before deploying — if any new dependency adds analytics, build fails
- Contributor CLA reminds: "Awesome Yoto is privacy-first; no analytics dependencies added without maintainer approval"
- If a contributor proposes an analytics-friendly alternative (e.g., Plausible self-hosted), it requires maintainer review and ADR update

## Consequences

### Positive
- **Zero cost** — no paid analytics service, no vendor contracts
- **Zero compliance burden** — no GDPR/CCPA analysis for analytics data
- **Zero performance impact** — no extra scripts, no third-party requests
- **Trust aligned with mission** — parents using Yoto Player expect privacy
- **Future-proof** — no technical debt from migrating between analytics vendors

### Negative
- **Limited SEO insights** — no real-time funnel data, no cohort analysis, no behavior flow
- **Blind to UX issues** — can't A/B test layouts, can't measure drop-off, can't optimize conversion
- **Reliance on Search Console** — only captures search traffic, not direct visits or social referrals
- **Harder to prove impact** — no dashboards showing "X people tried the chooser this month"

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Plausible self-hosted | Still sends browsing data; adds infrastructure; violates "no backend" principle |
| Fathom | SaaS cost, even minimal; still collects behavioral data |
| Simple Counter (pixel tracking) | Even a 1×1 pixel is "analytics"; violates philosophy |
| No tracking at all (current) | Accepted — Search Console provides sufficient SEO signal for our use case |

## Enforcement

- `pnpm check:budget` must stay green (JS bundle under 30 KB gzip)
- `pnpm verify` runs full check; any new `npm dependency` pulling in analytics fails
- New dependencies must pass `pnpm audit --audit-level=high` with no new vulnerabilities
- Any proposed analytics addition requires a new ADR (reverting to this decision)
- The `scripts/check-budget.ts` script scans `package.json` for known analytics packages

## References

- [Roadmap §8: Métriques de succès — "sans analytics"](https://github.com/yoto-community/yoto-community.github.io/blob/main/docs/roadmap.md#L753-L767)
- `scripts/check-budget.ts` — budget enforcement
- `scripts/check-links.ts` — weekly link health (the only scheduled data refresh)
- CLA contributor agreement — privacy clause