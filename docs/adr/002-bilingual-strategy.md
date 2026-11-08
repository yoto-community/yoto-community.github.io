# ADR 002: URL-Based Bilingual Routing (No Browser Detection)

**Status:** Accepted
**Date:** 2026-11-08
**Deciders:** Project maintainers

## Context

The portal serves both English and French audiences. We need a strategy for language selection that is:
- SEO-friendly (indexable by search engines in both languages)
- Shareable (a French link stays French when shared)
- Predictable (no surprise redirects)
- Compatible with static hosting (no server-side logic)

## Decision

**Language is determined solely by the URL path prefix:**
- `/` or `/en/` → English
- `/fr/` → French

No browser language detection, no `Accept-Language` header reading, no automatic redirects, no geo-IP. The user chooses by clicking the language toggle in the header (which links to the equivalent page in the other language).

All routes are duplicated: `/projects/` and `/fr/projects/`, `/chooser/` and `/fr/chooser/`, `/p/<slug>/` and `/fr/p/<slug>/`.

## Consequences

### Positive
- **SEO-optimal** — each language has its own indexable URLs with proper `hreflang` tags
- **Shareable** — a `/fr/chooser/` link works for anyone, anywhere
- **Predictable** — no surprise language switches; user intent is explicit
- **Static-friendly** — Astro generates both language trees at build time; no runtime logic needed
- **Cacheable** — each URL is a distinct cache key; no `Vary: Accept-Language` complexity
- **Accessible** — language toggle is a standard `<a>` link, works without JS

### Negative
- **Content duplication** — every page exists in two files (mitigated by shared components + i18n keys)
- **Maintenance burden** — new pages must be created in both languages
- **No "smart" default** — first-time visitors see English unless they navigate to `/fr/`

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Browser `Accept-Language` detection + redirect | Breaks shareable links; SEO issues (Googlebot may not see FR); unpredictable |
| Single-page app with client-side i18n switch | Loses SEO; breaks deep linking; adds JS bundle weight |
| Subdomain (`fr.yoto-community.github.io`) | SSL cert complexity on GitHub Pages; cookie sharing issues; more DNS config |
| Query param (`?lang=fr`) | Ugly URLs; SEO dilution; caching complications |

## Implementation Details

- **Astro i18n pattern**: `site/src/pages/` + `site/src/pages/fr/` mirror structure
- **Shared components**: All UI strings in `site/src/i18n/en.ts` and `fr.ts` (type-safe)
- **Route helpers**: `localePath(lang, path)` in `site/src/lib/routes.ts` generates correct prefixed URLs
- **Validation**: `pnpm check:i18n` verifies route parity; `pnpm check:fr` verifies content coverage
- **hreflang**: Auto-generated in `Base.astro` `<head>` for every page

## Enforcement

- CI fails if `site/src/pages/` and `site/src/pages/fr/` drift (route parity check)
- New pages must be added in both locations; PR template reminds contributors
- `pnpm check:fr` enforces 100% `descriptionFr` coverage on project entries

## References

- [Astro i18n guide](https://docs.astro.build/en/guides/internationalization/)
- [Roadmap: "Les routes et les chaînes d'interface sont, elles, à parité (test CI)"](https://github.com/yoto-community/yoto-community.github.io/blob/main/docs/roadmap.md#L50-L51)
- `site/src/lib/routes.ts` — route generation utilities