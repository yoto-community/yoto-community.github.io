# ADR 006: Unified community header across the three sites

**Status:** Accepted (amended 2026-11-09)
**Date:** 2026-11-09
**Deciders:** Project maintainers

## Context

The Yoto Community ecosystem spans three sites on the same origin
(`yoto-community.github.io`):

1. **Portal** (`/`) — curated project directory, chooser, MYO guide
2. **Icon catalogue** (`/icons-catalogue/`) — 27,000+ searchable 16×16 icons
3. **Podcast directory** (`/podcast-catalogue/`) — child-safe podcast feeds

Before this decision, moving between them felt like changing sites:

- each header used a different brand (`Awesome Yoto`, `Yoto Icons Catalogue`,
  `Annuaire de podcasts`) and the icon catalogue used a different logo mark;
- links to the sibling sites were buried in a « Communauté » dropdown, opened
  in a new tab and carried an external-link arrow;
- the order and labels of those links changed from one site to the next.

These apps share one origin, one design system and one storage contract
(`yoto-community:*`, see ADR 003). The navigation should express that.

A first iteration stacked two full-width rows: a community bar and an app bar.
It read as two headers, and the app name repeated the active sibling link
(« Awesome Yoto » highlighted in row 1, then « Awesome Yoto » again in row 2).
On mobile it produced three stacked bands before the content. The decision was
amended to merge both rows into a single bar.

## Decision

**All three sites render the same single-row community header.**

The bar reads left to right:

1. **Brand**: the waveform mark + **Yoto Community**, linking to the portal in
   the current language.
2. **Sibling links**, always in this order and with these labels:
   1. `Awesome Yoto`
   2. `Catalogue d’icônes` / `Icons catalogue`
   3. `Annuaire de podcasts` / `Podcast directory`
      The current site is marked with `aria-current="page"`. Sibling links open in
      the **same tab** and carry no external-link marker. Links are localized: from
      a French page they point to `/fr/` on the portal and
      `/podcast-catalogue/fr/`; from an English page they point to the English
      equivalents. The icon catalogue is a single-page app, so its language comes
      from the shared `yoto-community:prefs:v1` preference.
3. A **thin divider** separates the community links from the app's own
   navigation.
4. **The app's local navigation** (unchanged: catalogue, categories, favorites,
   projects, authors, tools, community menu…).
5. A **settings gear** opening the language and theme selectors, backed by the
   same shared preferences contract on all three sites.

There is no second app bar and **no repeated app title**: the active sibling
link already identifies the current site. Local « Communauté » menus keep
contribution, GitHub and site-specific links (API, feed health, authors,
sources, developers), but **no sibling-site links** — those are promoted to the
community bar.

### Responsive behaviour

The bar stays one row at every width:

- **≥ 1152 px**: community links and local navigation are both inline.
- **720–1151 px**: the local navigation moves into a « Menu » dropdown; the
  sibling links stay visible.
- **< 720 px**: the sibling links also move into the « Menu » dropdown, grouped
  under « Sites de la communauté » / « Community sites ». Brand, settings and
  menu remain on one line.

### Implementation status

All three sites implement the single-row header: the portal
(`yoto-community.github.io`), the icon catalogue and the podcast directory.

## Consequences

### Positive

- A visitor perceives one product with three sections, not three unrelated
  sites.
- Sibling navigation is always in the same place, same order, one click away.
- Language and theme choices follow the visitor across sites.
- No new shared package or runtime coupling: each site keeps its own build.
- No duplicate app title; the header is one line tall and leaves more room for
  content.

### Negative

- A single bar carrying eight links plus settings is dense: labels use compact
  type and the settings control is an icon rather than a text button.
- The community bar markup and CSS are duplicated in the three repositories.
  Keeping them aligned is a social contract, checked by each site's tests.
- The icon catalogue's historical logo mark is retired from the header.

### Alternatives considered

| Alternative                                       | Rejected because                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Two stacked rows (community bar + app bar)        | Reads as two headers and repeats the app name / active site; three bands on mobile               |
| Keep sibling links in the « Communauté » dropdown | Still buried, still looks like an external link                                                  |
| Brand-only home link, no sibling links            | Sibling navigation becomes a click away and loses its fixed order                                |
| Shared npm package for the header                 | Three different stacks (Astro ×2, React ×1); duplication is cheaper than a build-time dependency |
| iframe / remote header                            | Breaks accessibility, SEO and the static-hosting constraint (ADR 001)                            |

## Enforcement

- The single-row structure and the sibling link order and labels are part of
  this ADR; any change must update all three repositories.
- `icons-catalogue` keeps `Header.test.tsx` assertions on the community bar
  (same-tab links, current site, no duplicate sibling links in the local menu).
- Visual parity relies on the shared design tokens already documented in each
  site's stylesheet (cream background, forest-green accent, Nunito, 20 px
  radius).
