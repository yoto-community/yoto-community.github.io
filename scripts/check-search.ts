import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'site/dist');
const required = [
  'index.html',
  'fr/index.html',
  'projects/index.html',
  'api/index.html',
  'fr/api/index.html',
  'p/louis/index.html',
  'myo/index.html',
  'about/index.html',
  'contribute/index.html',
  'categories/official/index.html',
  'collections/start-here/index.html',
  '404.html',
  'fr/404.html',
  'og.png',
  'favicon.svg',
  'robots.txt',
  'sitemap-index.xml',
  'pagefind/pagefind.js',
  'pagefind/pagefind-ui.js',
  'pagefind/pagefind-ui.css',
  'api/catalog.json',
  'api/projects.json',
  'api/categories.json',
];

const missing = required.filter(
  (file) => !existsSync(join(dist, file)) || statSync(join(dist, file)).size === 0,
);
if (missing.length > 0) {
  console.error(`Missing or empty build artifacts: ${missing.join(', ')}`);
  process.exit(1);
}

const projects = JSON.parse(readFileSync(join(dist, 'api/projects.json'), 'utf8')) as unknown[];
if (!Array.isArray(projects) || projects.length < 55) {
  console.error(`Expected at least 55 projects in the API, got ${projects.length}.`);
  process.exit(1);
}

const entry = JSON.parse(readFileSync(join(dist, 'pagefind/pagefind-entry.json'), 'utf8')) as {
  languages?: Record<string, { page_count?: number }>;
};
const pageCount = Object.values(entry.languages ?? {}).reduce(
  (total, language) => total + (language.page_count ?? 0),
  0,
);
if (pageCount < 58) {
  console.error(`Expected at least 58 indexed pages, got ${pageCount}.`);
  process.exit(1);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (html.includes('UNDEFINED') || html.includes('[object Object]')) {
  console.error('Rendered HTML contains interpolation leaks.');
  process.exit(1);
}

const astroDir = join(dist, '_astro');
if (!existsSync(astroDir)) {
  console.error('Missing build artifact directory: _astro/.');
  process.exit(1);
}

const bundle = readdirSync(astroDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(join(astroDir, file), 'utf8'))
  .join('\n');

const apiDir = join(dist, 'api');
const apiPayloads = readdirSync(apiDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => readFileSync(join(apiDir, file), 'utf8'));

const scanned = [
  html,
  readFileSync(join(dist, 'fr/index.html'), 'utf8'),
  ...apiPayloads,
  bundle,
].join('\n');
if (/ghp_|github_pat_|GITHUB_TOKEN|Authorization:\s*Bearer/i.test(scanned)) {
  console.error('A secret or token-like string was found in the published output.');
  process.exit(1);
}

console.log(`Build artifacts OK: ${projects.length} projects, Pagefind index and API present.`);
