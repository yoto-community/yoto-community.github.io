# Launch and distribution checklist

One-time launch actions for Awesome Yoto, followed by the maintenance that keeps the
list worth aggregating. Commands run from the repository root. The GitHub settings need
organization-admin rights on `yoto-community`; none of them can be applied from CI.

Repository values (description, topics, labels) are kept here. [`CONTRIBUTING.md`](../CONTRIBUTING.md)
links to this file instead of repeating them, so the two cannot drift.

## 1. First push and Pages

The repository is named `yoto-community.github.io`, so it serves the organization root
site: Pages publishes at `https://yoto-community.github.io/` with `base: '/'` (see
`site/astro.config.mjs`).

- [ ] `pnpm verify` passes on `main` locally.
- [ ] Push: `git push -u origin main`.
- [ ] **Settings → Pages → Build and deployment → Source: GitHub Actions.** Do not choose
      "Deploy from a branch": `.github/workflows/pages.yml` builds `site/dist` and deploys it.
- [ ] Wait for the `Deploy` workflow (push to `main`, plus a nightly 04:00 UTC run) and open
      the URL shown in the `github-pages` environment.
- [ ] Verify the deployed routes:
  - [ ] `https://yoto-community.github.io/`
  - [ ] `https://yoto-community.github.io/projects/`
  - [ ] `https://yoto-community.github.io/myo/`
  - [ ] `https://yoto-community.github.io/api/` and `https://yoto-community.github.io/api/catalog.json`
  - [ ] `https://yoto-community.github.io/fr/` and `https://yoto-community.github.io/fr/myo/`
  - [ ] `https://yoto-community.github.io/sitemap-index.xml`
- [ ] Open a project deep link (`/p/<slug>/`) on a phone to confirm the static routes work
      without the dev server.
- [ ] Add the site to **About → Website**: `https://yoto-community.github.io/`.

## 2. Repository metadata

`awesome-lint` reads GitHub metadata through the API. Until this section is done, its four
metadata checks fail even though the README is valid.

- [x] **About → Description:**
      `Awesome Yoto — everything the Yoto community builds, in one place: apps, card makers, icon libraries, integrations and guides for the Yoto Player and MYO cards.`
- [x] **About → Topics:** `awesome`, `awesome-list`, `yoto`, `yoto-api`, `yoto-myo`,
      `yoto-player`, `yotoplay`. awesome-lint requires `awesome` and `awesome-list`;
      `sindresorhus/awesome` requires the `awesome` topic; project-awesome mirrors that list.
- [x] **About → Website:** `https://yoto-community.github.io/`.
- [x] **MIT license** is detected by GitHub (shown in the repository sidebar).
- [ ] **Organization profile → Customize pins:** pin the repository.

## 3. Make awesome-lint blocking

Order matters: metadata first, then the linter, then remove the escape hatch. Flipping first
turns every pull request red because of a repository setting.

- [x] Run the linter against the live repository. It now prints `✔ Linting` and exits 0:
      the description, topics and license documented above are in place.
- [x] `continue-on-error: true` is gone from the awesome-lint step in
      `.github/workflows/ci.yml`; it is now a blocking step named `awesome-lint` that runs
      `pnpm exec awesome-lint README.md`.
- [ ] Optional hardening: add `env: { github_token: ${{ secrets.GITHUB_TOKEN }} }` to the
      step. awesome-lint reads the lowercase `github_token` variable, and the token avoids the
      unauthenticated 60 requests/hour API limit on shared runners.
- [ ] Push the change and confirm the `CI` workflow's `check` job shows a green
      `awesome-lint` step on `main` and on a pull request.
- [ ] Never re-add `continue-on-error` for future failures: fix the README or the entry.

## 4. Branch protection

Use a repository ruleset (Settings → Rules → Rulesets) targeting `main`:

- [ ] **Require status checks to pass:** `check` (the job from `.github/workflows/ci.yml`).
      Do not require `Deploy`: it runs on push, not on pull requests, and would deadlock merges.
- [ ] **Block force pushes** and **restrict deletions**.
- [ ] **Bypass list:** add the **GitHub Actions** app with the "Always" bypass. The nightly
      `Deploy` run pushes `chore: refresh project metadata [skip ci]` to `main` with
      `GITHUB_TOKEN`; without the bypass, branch protection rejects that commit.
- [ ] Optionally require a pull request before merging. If enabled, the GitHub Actions app
      must bypass that rule as well, otherwise the nightly commit is still rejected.
- [ ] Verify the bypass the morning after the first 04:00 UTC `Deploy` run: `main` should have
      a `chore: refresh project metadata [skip ci]` commit and the run should stay green.
      The commit step uses `continue-on-error: true`, so a missing commit is silent — the site
      still deploys, but `data/.meta.json` never updates.

For a classic branch protection rule the equivalent is "Require status checks to pass" with
`check`, plus "Allow specified actors to bypass required pull requests" for the GitHub Actions
app. Rulesets are preferred because they expose the bypass for required checks directly.

## 5. Labels

Create both labels up front so their colors and descriptions are stable. Each workflow creates
its label if missing, but these commands set the intended values.

```bash
gh label create link-health --color B45309 --description "Dead links report" --force
gh label create app:submission --color 0E8A16 --description "App submitted through the issue form" --force
```

- [ ] `link-health` — amber `#B45309`; opened, updated and auto-closed by
      `.github/workflows/link-health.yml` every Monday at 06:00 UTC.
- [ ] `app:submission` — green `#0E8A16`; applied by the issue form and the only label that
      triggers `.github/workflows/issue-to-pr.yml`.

## 6. Submit to the aggregators

Do this only after sections 2–3 are green and the site is live. Section 6.2 is a **v2 decision**,
not a v1 launch step.

### 6.1 Project Awesome

<https://project-awesome.org/> mirrors `sindresorhus/awesome`; there is nothing to submit —
indexing follows the upstream merge.

No action in v1 — revisit only if the sindresorhus move happens.

### 6.2 sindresorhus/awesome

Read both files before opening anything:

- <https://github.com/sindresorhus/awesome/blob/main/contributing.md>
- <https://github.com/sindresorhus/awesome/blob/main/pull_request_template.md>

**v2 decision.** The `awesome-*` repository-name rule cannot be met while the list lives in
`yoto-community.github.io`: complying means moving the list into its own repository, which the
v1 scope rules out. Skip this aggregator until v2, or record the move as an explicit v2 decision.
The timing gate below applies whenever that happens.

**Timing gate:** wait 4–6 weeks after launch and until at least two external contributions
(from people outside `yoto-community`) have been merged. They reject stubs and draft pull
requests; the list must already look curated.

**Requirements to check before submitting** (current status in brackets):

- [ ] Repository is at least 30 days old. [satisfied by the timing gate]
- [ ] Repository name is a lowercase `awesome-*` slug.
      [**not satisfied**: the repository is `yoto-community.github.io`. Complying means moving
      the list into its own `awesome-yoto` repository, which v1 rules out — **skip until v2**]
- [ ] License is CC0 or another Creative Commons license; MIT is explicitly rejected.
      [**not satisfied**: this repository is MIT. Licensing the list text under CC0 while
      keeping the code MIT is a v2 decision]
- [ ] The README does not name or reproduce the license.
      [**not satisfied**: `README.md:120` contains the sentence
      `Released under the [MIT license](LICENSE).`; their template forbids the license name,
      text or a Licence section in the README. To become eligible, remove that sentence from the
      generator (`scripts/lib/readme.ts:71`), update the golden test (`tests/readme.test.ts:104`)
      and run `pnpm build:data` so `README.md` is regenerated. Keep the license in the root
      `LICENSE` file only]
- [ ] No archived, deprecated or unmaintained entries. [**not satisfied**: the editorial policy
      keeps `stale`, `archived` and `deprecated` entries; moving them to a separate Markdown
      file is a v2 decision]
- [ ] `awesome-lint` is green. [satisfied after sections 2–3]
- [ ] No CI badge in the README. [satisfied: only the Awesome badge is present]
- [ ] Contents section, Awesome badge, contribution guidelines, no hard wrapping. [satisfied]
- [ ] Pull request title `Add Yoto`; entry at the bottom of `Hardware` or `Miscellaneous`; URL
      ending in `#readme`; the entry title is title-cased; the description starts with an
      uppercase letter and ends with a period.
- [ ] Review at least four open pull requests in their repository and comment on them, then
      comment the word `unicorn` on your own pull request. Both are in their template.
- [ ] State that the list is human-curated: fully AI-generated submissions are rejected.

The unmet requirements above are v2 decisions, not documentation bugs. Record the decision in
this file when it is made.

**Already satisfied by the current repository and list:**

- Default branch is `main`.
- The heading is title case: `# Awesome Yoto`.
- The Contents section omits `Contributing` and `Footnotes` (both sections are allowed, but must
  not appear in the table of contents).

The `awesome` and `awesome-list` topics are part of section 2 and are applied.

## 7. Cross-link the two catalogues

Two separate pull requests, one per repository. Do this after the main site is live and before
the announcements, so the links resolve.

- [ ] `yoto-community/icons-catalogue`
- [ ] `yoto-community/podcast-catalogue`

In each repository:

- [ ] Header: add a **Community** link to `https://yoto-community.github.io/` next to the
      existing menu items (`icons-catalogue` already has a "Communauté" menu). Match the
      existing item markup; if the header is translated, add the label to both locales.
- [ ] Footer: add one line that points at the MYO guide:
      `Part of the [Yoto Community](https://yoto-community.github.io/) — [build your first MYO card](https://yoto-community.github.io/myo/).`
      Translate the French footer.
- [ ] Reuse the existing link styles and tokens. No CSS variable, design token, layout or
      dependency changes.
- [ ] Run the repository's own verify command and let its CI pass before asking for review.

## 8. Announce

- [ ] **Yoto Space developers** — <https://yoto.space/developers>: a short post on what the
      portal covers (projects, MYO guide, icons, podcasts, static API) and how to submit an
      entry (issue form or pull request). Link the site and the README.
- [ ] **r/YotoPlayer** — <https://www.reddit.com/r/YotoPlayer/>: a parent-oriented post, no API
      or repository jargon. Lead with the MYO guide, the icon catalogue and the podcast catalogue.
- [ ] **French communities** — mention the French portal
      (<https://yoto-community.github.io/fr/>) and that both catalogues are usable in French.
- [ ] Do not cross-post identical text: each audience gets its own framing.

Badge for listed projects, offered when a maintainer asks. Do not add it to other repositories
unprompted.

```markdown
[![Awesome Yoto](https://img.shields.io/badge/Awesome-Yoto-006D41)](https://yoto-community.github.io/)
```

```text
<a href="https://yoto-community.github.io/"><img alt="Awesome Yoto" src="https://img.shields.io/badge/Awesome-Yoto-006D41"></a>
```

The color `006D41` is the site accent (`--accent` in `site/src/styles/tokens.css`).

## 9. Maintenance cadence

**Weekly — link health.** Triage the `link-health` issue.
`.github/workflows/link-health.yml` runs `pnpm check:links` every Monday at 06:00 UTC, updates
the issue and closes it when the dead-link count reaches zero. Fix, replace or deprecate each
dead link, then run `pnpm validate && pnpm build:data`. Reproduce locally with `pnpm check:links`
(it writes `link-report.md` and `.dead-count`).

**Monthly — stale review.** Review status suggestions from `pnpm enrich`
(`GITHUB_TOKEN=$(gh auth token) pnpm enrich` locally). It prints `maintained` after 183 days and
`stale` after 365 days without a commit. Promote, deprecate (`deprecated` plus `deprecatedBy`)
or archive; commit `data/.meta.json` with the status changes and run `pnpm verify`.

**Quarterly — prune and refresh.** Remove zero-value entries following the editorial rules,
refresh the MYO guide in `site/src/pages/myo.astro` and `site/src/pages/fr/myo.astro`, confirm
both catalogue links still resolve, then run `pnpm check:links && pnpm verify`.

**Every release — verify the published site.** After the `Deploy` run, open
`https://yoto-community.github.io/fr/` and
`https://yoto-community.github.io/api/catalog.json` (plus `/api/index.html`) and confirm the
Pages environment URL.

Launch is complete when the site is live, the metadata is set, awesome-lint is blocking, the
ruleset and labels exist, both catalogue pull requests are merged and the announcement is
posted.

## Related files

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — submission paths, local commands and editorial rules.
- [`README.md`](../README.md) — the generated list and the public entry point.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — the `check` job required by branch protection.
- [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) — the `Deploy` workflow and nightly metadata commit.
- [`.github/workflows/link-health.yml`](../.github/workflows/link-health.yml) — the weekly link report.
- [`.github/workflows/issue-to-pr.yml`](../.github/workflows/issue-to-pr.yml) — the submission form conversion.
