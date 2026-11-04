import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './lib/config';
import { fetchJson } from './lib/http';
import { createLoader } from './lib/load';
import { metaFromApi, repoFromUrl, suggestStatus } from './lib/meta';

const load = createLoader();
const projects = load.projects();
const previous = load.meta();
const currentSlugs = new Set(projects.map((project) => project.slug));
const projectsMeta = Object.fromEntries(
  Object.entries(previous.projects).filter(([slug]) => currentSlugs.has(slug)),
);
const today = new Date().toISOString().slice(0, 10);
let updated = 0;
let attempted = 0;

for (const project of projects) {
  if (!project.repo) continue;
  const target = repoFromUrl(project.repo);
  if (!target) continue;
  attempted++;
  try {
    const json = await fetchJson<unknown>(
      `https://api.github.com/repos/${target.owner}/${target.repo}`,
      { token: process.env.GITHUB_TOKEN },
    );
    projectsMeta[project.slug] = metaFromApi(json);
    updated += 1;
  } catch (error) {
    console.warn(`warning: ${project.slug} not refreshed (${(error as Error).message})`);
  }
}

// Only write if at least one project was successfully refreshed
if (updated > 0) {
  writeFileSync(
    join(DATA_DIR, '.meta.json'),
    `${JSON.stringify({ updatedAt: today, projects: projectsMeta }, null, 2)}\n`,
  );
}

for (const project of projects) {
  const meta = projectsMeta[project.slug];
  if (meta) {
    console.log(`${project.slug.padEnd(32)} ${suggestStatus(meta, today)}`);
  }
}

console.log(
  `Refreshed ${updated}/${attempted} (${projects.length - attempted} without a repo, ${attempted - updated} failed)`,
);
