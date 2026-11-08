# ADR 004: Chooser Algorithm — No `bestFor` Field Yet

**Status:** Accepted
**Date:** 2026-11-08
**Deciders:** Project maintainers

## Context

The `chooser` (3-question recommender) needs a scoring algorithm that ranks projects against user goals (youtube→card, files→card, podcast→card, etc.) while penalizing gaps (unsuitable platform, advanced requirements in simple mode, deprecated status).

The algorithm exists in `site/src/lib/chooser.ts` and has been tested against 6 personas. It uses a scoring system based on goal/category/tag matching, platform compatibility, advanced requirements penalty, and stale/archived status penalty. The output gives 1 recommendation + 2 alternatives, each with reasons.

## Decision

**No `bestFor` field on project entries** in the YAML data model. The scoring is entirely data-driven from existing fields: `category`, `tags`, `platforms`, `requires`, `status`, `official`, `warning`.

### Why No `bestFor`

1. **Existing data suffices** — 6 personas test passes with `category`, `tags`, `platforms`, `requires`, `status`, `official` alone
2. **Avoids speculative data** — `bestFor` would require contributors to add opinion fields per project; high risk of inconsistent or marketing-flavored entries
3. **Scoring is transparent** — users see explicit reasons (goal match, platform fit, simple mode friendly, official status) rather than an opaque "best for" label
4. **Score ranges handle ranking** — projects with score > 0 are recommended; those < 0 are filtered out; ties broken by stars then name
5. **Gate before adding** — if 6 personas fail on existing data, adding fields won't fix the root issue; better to improve scoring rules first

### What the Score Communicates

Each recommendation includes `reasons: ReasonCode[]` which translates to human-readable labels:
- `goal` → "Made for YouTube" / "Pensé pour YouTube"
- `category` → "Fits this task" / "Adapté à cette tâche"
- `platform` → "Works on macOS" / "Fonctionne sur macOS"
- `simple` → "No terminal or API key" / "Sans terminal ni clé API"
- `official` → "Official Yoto tool" / "Outil officiel Yoto"

The top 3 reasons are shown; the score itself is internal to the algorithm.

### Scoring Rules (from `chooser.ts`)

| Rule | Weight |
|------|--------|
| Goal category match | +4 |
| Goal tag match | +3 per tag |
| Goal-relevant + platform match | +3 |
| Stale status | -5 |
| Simple mode + advanced tool | -3 |

Minimum score to recommend: `> 0`. If fewer than 3 projects score > 0, fewer results are shown rather than padding with irrelevant projects.

### Future `bestFor` Path (if needed)

If personas testing reveals gaps, `bestFor` could be added later as an **optional** YAML field with validation:
- Schema: `bestFor?: string` (free text, 20–80 chars)
- Would only be shown if present; projects without it continue to work
- Guard: never auto-fill; always contributor-written

## Consequences

### Positive
- **Low contributor burden** — no new field to fill per project
- **Consistent behavior** — all projects scored by same rules from existing data
- **Transparent UX** — reasons are explicit, not a single "best for" claim
- **Persona-tested** — 6 real-user tests already pass
- **No scope creep** — keeps chooser focused on 3 questions

### Negative
- **Less personalized** — can't say "great for families" or "best for kids' rooms"
- **Harder to surface niche tools** — some tools might be perfect for a specific use case but don't match category/tag patterns
- **Future technical debt** — if personas fail, `bestFor` will need to be added anyway

## Enforcement

- 6 unit tests in `site/src/lib/chooser.test.ts` validate scoring logic
- 6 persona integration tests exist in `tests/chooser-personas.test.ts`
- PR template reminds contributors: "Do not add `bestFor` field unless personas require it"
- `pnpm validate` + `pnpm check` gates ensure chooser logic unchanged

## References

- `site/src/lib/chooser.ts` — scoring implementation
- `site/src/lib/chooser.test.ts` — unit tests
- `tests/chooser-personas.test.ts` — 6-persona validation
- [Roadmap 4.1 T6: Contenu — vérification 6 personas réels](https://github.com/yoto-community/yoto-community.github.io/blob/main/docs/roadmap.md#L294-L295)