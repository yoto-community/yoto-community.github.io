# Contributing to Awesome Yoto

Thanks for helping parents and makers get more out of the Yoto Player. This list stays useful because every entry is curated by a human, not scraped.

## Submit a project

Two ways to get an entry in:

1. **Open an issue.** Use the "Submit an app" issue form with the name, URL, category and a one-sentence description. The submission workflow turns it into a pull request, which a maintainer reviews.
2. **Open a pull request.** Add one YAML file under `data/projects/`, named after the project slug (`louis.yml`, `yoto-sdk.yml`). Copy an existing file as a template and check it against `schema/project.schema.json`.

Every entry needs a `name`, an `https://` `url`, a `description` between 20 and 180 characters, a `category` slug from `data/categories.yml`, one to eight `tags`, an `author`, a `license`, a `status`, at least one platform, and the `added` date in `YYYY-MM-DD` form. Set `descriptionFr` when you can write French. If you mark an entry `deprecated`, also provide `deprecatedBy`.

## Run the checks locally

Node.js 22.23.4 or newer is required (see `.nvmrc`), together with pnpm 10.

The site depends on `@yoto-community/pixel-editor-core`, published on GitHub Packages. Register a `read:packages` token in your **user** npm config once; nothing is committed to the repository:

```bash
gh auth refresh -s read:packages
echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> ~/.npmrc
```

A classic PAT with the `read:packages` scope works too, in place of `$(gh auth token)`.

```bash
pnpm install
pnpm validate      # schema, duplicates, categories and tags
pnpm build:data    # regenerate README.md and the site catalog
pnpm verify        # the full gate that CI runs
pnpm audit --audit-level=high  # dependency vulnerabilities
```

Run `pnpm build:data` after editing data and commit the regenerated `README.md`; `pnpm check:readme` fails if the two drift apart.

## Editorial rules

- One entry per repository. If a project ships several apps, list the repository once and describe what it covers.
- No DRM circumvention, no paywall bypassing, no tools whose main purpose is to copy content you do not own. We do not list cracks, key generators or scrapers of paid catalogues.
- Backups are welcome only for content you own: describe them as personal backups and mark them with the `legal-backup` warning.
- Deprecated projects stay in the list with a `status` of `stale`, `archived` or `deprecated`, plus a `deprecatedBy` pointer when there is a replacement. Removing history is a last resort.
- Official first-party projects are marked `official: true`; everything else is community work, even when it is excellent.
- Write the description for a parent, not for a compiler: say what the project does and who it is for, without hype.
- Keep the list child-safe. If a tool can pull arbitrary audio into a card, say so plainly.

## Repository settings

Maintainers apply these once at launch: the Pages source (GitHub Actions), the repository description and topics, branch protection on `main`, and the two issue labels.

The exact values, ordered steps and verification commands live in the [launch checklist](docs/launch-checklist.md). Update that file when a setting changes, rather than duplicating values in both places.

For contributors, the only setting that affects day-to-day work is branch protection on `main`: a pull request must pass the `check` job. The GitHub Actions app cannot be added to the bypass list, so the nightly metadata commit may be rejected by the required status check; the deploy step is non-blocking so the site still deploys with fresh metadata.

By contributing you agree that your entry is published under the [MIT license](LICENSE).
