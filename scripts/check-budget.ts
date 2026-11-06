import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const dist = join(root, 'site/dist');
const assetsDir = join(dist, '_astro');
const limit = 30 * 1024;

if (!existsSync(assetsDir)) {
  console.error(
    `Missing ${relative(root, assetsDir)}: run "pnpm build" before "pnpm check:budget".`,
  );
  process.exit(1);
}

interface Entry {
  file: string;
  size: number;
}

const gzipSize = (contents: string | Buffer) => gzipSync(contents, { level: 9 }).length;
const isScriptFile = (file: string) => file.endsWith('.js') || file.endsWith('.mjs');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    // Pagefind ships its own library; the budget only covers site JavaScript.
    if (entry.isDirectory()) return entry.name === 'pagefind' ? [] : walk(path);
    return entry.isFile() ? [path] : [];
  });
}

const bundles: Entry[] = [];
const linked: Entry[] = [];
const inline: Entry[] = [];
const counted = new Set<string>();

for (const path of walk(assetsDir).filter(isScriptFile)) {
  counted.add(path);
  bundles.push({ file: relative(root, path), size: gzipSize(readFileSync(path)) });
}

const distFiles = new Set(walk(dist));
const pages = [...distFiles].filter((file) => file.endsWith('.html'));

// Feature scripts with their own tighter budget. Keys are paths relative to site/dist.
const PAGE_SCRIPT_LIMITS = new Map<string, number>([
  ['chooser/index.html', 6 * 1024],
  ['fr/chooser/index.html', 6 * 1024],
]);
const pageScripts = new Map<string, Entry[]>();

if (pages.length === 0) {
  console.error('No HTML pages found in site/dist: refusing to report a JavaScript budget.');
  process.exit(1);
}

// Astro inlines small client bundles straight into the HTML, so `_astro` is not
// the whole JavaScript surface. Inline modules and classic scripts count too;
// JSON-LD and other data blocks do not.
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const isJavaScript = (attributes: string) => {
  if (/\bsrc\s*=/.test(attributes)) return false;
  const type = (/type\s*=\s*["']([^"']*)["']/.exec(attributes)?.[1] ?? '').toLowerCase();
  return type === '' || type === 'module' || type === 'text/javascript';
};

const localScript = (page: string, src: string): string | undefined => {
  const path = (src.split(/[?#]/)[0] ?? '').trim();
  if (!path || path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return undefined;
  const resolved = resolve(path.startsWith('/') ? join(dist, path) : join(dirname(page), path));
  return resolved.startsWith(`${dist}${sep}`) && distFiles.has(resolved) ? resolved : undefined;
};

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const scripts: Entry[] = [];
  for (const match of html.matchAll(scriptPattern)) {
    const attributes = match[1] ?? '';
    const body = match[2] ?? '';
    const src = /\bsrc\s*=\s*["']([^"']*)["']/.exec(attributes)?.[1];

    if (src !== undefined) {
      // Pagefind is excluded by the budget; every other local script counts once.
      if (/(?:^|\/)pagefind\//.test(src)) continue;
      const file = localScript(page, src);
      if (!file) continue;
      const size = gzipSize(readFileSync(file));
      scripts.push({ file: `${relative(root, file)} (script src)`, size });
      if (counted.has(file)) continue;
      counted.add(file);
      linked.push({ file: `${relative(root, file)} (script src)`, size });
      continue;
    }

    if (!body.trim() || !isJavaScript(attributes)) continue;
    const size = gzipSize(body);
    const entry = { file: `${relative(root, page)} (inline script)`, size };
    scripts.push(entry);
    inline.push(entry);
  }
  pageScripts.set(relative(dist, page).split(sep).join('/'), scripts);
}

const all = [...bundles, ...linked, ...inline];
const total = all.reduce((sum, entry) => sum + entry.size, 0);
const kb = (bytes: number) => (bytes / 1024).toFixed(1);
const sum = (entries: Entry[]) => entries.reduce((value, entry) => value + entry.size, 0);

if (total > limit) {
  console.error(`JavaScript budget exceeded: ${kb(total)} KB > ${limit / 1024} KB gzip.`);
  console.error(`Files (${all.length}):`);
  for (const entry of [...all].sort((a, b) => b.size - a.size)) {
    console.error(`  ${kb(entry.size).padStart(6)} KB  ${entry.file}`);
  }
  process.exit(1);
}

console.log(`JavaScript budget OK: ${kb(total)} KB gzip.`);
console.log(`  ${kb(sum(bundles))} KB gzip — ${bundles.length} file(s) in site/dist/_astro/`);
if (linked.length > 0) {
  console.log(`  ${kb(sum(linked))} KB gzip — ${linked.length} linked script file(s)`);
}
console.log(
  `  ${kb(sum(inline))} KB gzip — ${inline.length} inline script(s) in ${pages.length} pages`,
);

for (const [page, limit] of PAGE_SCRIPT_LIMITS) {
  const scripts = pageScripts.get(page);
  if (!scripts) continue;
  const pageTotal = sum(scripts);
  if (pageTotal > limit) {
    console.error(
      `Page script budget exceeded: ${page} ${kb(pageTotal)} KB > ${limit / 1024} KB gzip.`,
    );
    for (const entry of scripts) console.error(`  ${kb(entry.size).padStart(6)} KB  ${entry.file}`);
    process.exit(1);
  }
  console.log(
    `Page script budget OK: ${page} ${kb(pageTotal)} KB gzip (limit ${limit / 1024} KB).`,
  );
}
