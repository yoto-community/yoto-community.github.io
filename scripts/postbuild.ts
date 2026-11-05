import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/config';

const source = join(ROOT, 'site/src/generated/catalog.json');
const apiDir = join(ROOT, 'site/dist/api');
mkdirSync(apiDir, { recursive: true });
copyFileSync(source, join(apiDir, 'catalog.json'));

const catalog = JSON.parse(readFileSync(source, 'utf8')) as {
  projects: unknown[];
  categories: unknown[];
};
writeFileSync(join(apiDir, 'projects.json'), `${JSON.stringify(catalog.projects, null, 2)}\n`);
writeFileSync(join(apiDir, 'categories.json'), `${JSON.stringify(catalog.categories, null, 2)}\n`);

const changelogSource = join(ROOT, 'site/src/generated/changelog.json');
if (existsSync(changelogSource)) {
  copyFileSync(changelogSource, join(apiDir, 'changelog.json'));
}

console.log('API JSON copied to site/dist/api/.');

// Astro only flattens the root 404/500 routes to <name>.html; a nested status
// page is emitted as fr/404/index.html. The language switch points at
// /fr/404.html, so move it and drop the directory-shaped duplicate.
const fr404Dir = join(ROOT, 'site/dist/fr/404');
const fr404Source = join(fr404Dir, 'index.html');
if (existsSync(fr404Source)) {
  copyFileSync(fr404Source, join(ROOT, 'site/dist/fr/404.html'));
  rmSync(fr404Dir, { recursive: true, force: true });
}
