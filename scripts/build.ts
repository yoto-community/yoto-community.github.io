import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITE_GENERATED_DIR } from './lib/config';
import { buildCatalog } from './lib/catalog';
import { createLoader } from './lib/load';
import { renderReadme } from './lib/readme';

const load = createLoader();
const categories = load.categories();
const projects = load.projects();
const tags = load.tags();
const collections = load.collections();
const check = process.argv.includes('--check');

const readme = renderReadme({ categories, projects, collections });
const readmePath = join(ROOT, 'README.md');
const current = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';

if (check) {
  if (current !== readme) {
    console.error('README.md is out of date. Run `pnpm build:data` and commit the result.');
    process.exit(1);
  }
  console.log('README.md is up to date.');
} else {
  writeFileSync(readmePath, readme);
  mkdirSync(SITE_GENERATED_DIR, { recursive: true });
  writeFileSync(
    join(SITE_GENERATED_DIR, 'catalog.json'),
    `${JSON.stringify(buildCatalog({ categories, projects, tags, collections }), null, 2)}\n`,
  );
  console.log(`Generated README.md and ${projects.length} projects for the site.`);
}
