# ADR 003: Same-Origin Shared Toolkit via localStorage Contract

**Status:** Accepted
**Date:** 2026-11-08
**Deciders:** Project maintainers

## Context

The Yoto Community ecosystem spans three sites on the same origin (`yoto-community.github.io`):
1. **Portal** (`/`) — curated project directory, chooser, MYO guide
2. **Icon Catalogue** (`/icons-catalogue/`) — 27,000+ searchable 16×16 icons
3. **Podcast Catalogue** (`/podcast-catalogue/`) — 198+ child-safe podcast feeds

They share the same origin, so they share `localStorage`, `sessionStorage`, and `storage` events. Currently each site uses disjoint keys:
- Portal: `yoto-favorites`, `yoto-toolkit`, `locale`
- Icons: `yoto-icons-favorites`, `yoto-icons-theme`
- Podcasts: `yoto-podcast-favorites`

This fragments user data and prevents a unified "toolkit" experience across the ecosystem.

## Decision

**Define a versioned, namespaced storage contract** under the `yoto-community:*` prefix that all three sites will adopt. The contract enables a shared "toolkit" (saved projects, icons, podcasts) and shared preferences (theme, locale) without any backend or cross-site coordination beyond the documented schema.

### Contract Schema

```json
{
  "yoto-community:toolkit:v1": {
    "version": 1,
    "items": [
      { "type": "project", "id": "louis", "title": "Louis", "addedAt": "2026-11-08" },
      { "type": "icon", "id": "moon-42", "title": "Moon", "addedAt": "2026-11-08" },
      { "type": "podcast", "id": "une-histoire", "title": "Une histoire", "addedAt": "2026-11-08" }
    ]
  },
  "yoto-community:prefs:v1": {
    "version": 1,
    "theme": "system",
    "locale": "fr"
  }
}
```

### Rules
1. **Namespace**: All keys prefixed with `yoto-community:`
2. **Versioning**: Every key includes `:vN` suffix; unknown versions are ignored (forward-compatible)
3. **Migration**: On first write, read legacy keys (`yoto-favorites`, `yoto-icons-favorites`, etc.) in **read-only** mode, merge into new contract, then write new keys. **Never delete legacy keys** — they remain for backward compatibility.
4. **Resilience**: All `localStorage` access wrapped in `try/catch` (private browsing, storage disabled, quota exceeded). Absence of storage never breaks the page.
5. **Sync**: Cross-tab synchronization via native `storage` event listener.
6. **Privacy**: No personal data, no identifiers, no network sync. Export/import JSON available on `/toolkit/`.

### Rollout Phases
1. **Portal-only** (current): Implement contract + toolkit UI on portal; document in `docs/shared-storage.md`
2. **Icons Catalogue** (separate PR): Mirror `yoto-icons-favorites` → `yoto-community:toolkit:v1` (read-only migration)
3. **Podcast Catalogue** (separate PR): Same pattern when deployed
4. **Preferences**: Shared `locale` and `theme` via `yoto-community:prefs:v1`

## Consequences

### Positive
- **Unified UX** — save a project on portal, see it in toolkit; favorite an icon, appears in same toolkit
- **No accounts needed** — works entirely client-side, same-origin
- **Portable** — export/import JSON moves toolkit between browsers/devices
- **Resilient** — gracefully degrades if storage unavailable
- **Decoupled deployments** — each site adopts contract independently; no coordinated releases

### Negative
- **Storage limits** — `localStorage` quota (~5–10 MB) limits toolkit size (mitigated: store only IDs + titles, not full objects)
- **Browser clearance risk** — users clearing site data loses toolkit (mitigated: export/import feature)
- **No server backup** — by design (privacy-first); user owns their data
- **Contract drift risk** — mitigated by single source of truth in `docs/shared-storage.md` + shared constants module

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Shared npm package `@yoto-community/shared-storage` | Overhead for 30-line contract; duplication is simpler until 3+ consumers |
| Root-level Service Worker | Would control sub-site caches; high risk of silent breakage; each site keeps own SW |
| Cookies for shared state | No auth needed; cookies sent with every request; `localStorage` is purpose-built |
| URL-based toolkit state (`?toolkit=...`) | URLs too long; not persistent; not shareable across sessions |
| IndexedDB | Overkill for < 100 items; `localStorage` synchronous API simpler for this use case |

## Enforcement

- `docs/shared-storage.md` is the **single source of truth** for the contract
- Each site's PR adopting the contract must reference this ADR
- `site/src/lib/toolkit.ts` (portal) contains the reference implementation
- CI does not enforce cross-repo contract compliance (social contract only)

## References

- [Roadmap §4.6: Same-origin contract](https://github.com/yoto-community/yoto-community.github.io/blob/main/docs/roadmap.md#L558-L663)
- `docs/shared-storage.md` — detailed contract specification
- `site/src/lib/toolkit.ts` — portal implementation
- `site/src/scripts/toolkit.ts` — client-side toolkit UI logic