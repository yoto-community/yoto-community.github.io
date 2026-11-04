import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'site/dist');

if (!existsSync(dist)) {
  console.error('Run `pnpm build` first.');
  process.exit(1);
}

function pages(dir: string, prefix = ''): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.isDirectory()) return pages(join(dir, entry.name), `${prefix}${entry.name}/`);
    return entry.name === 'index.html' ? [prefix] : [];
  });
}

const all = new Set(pages(dist));
const english = [...all].filter((path) => !path.startsWith('fr/')).sort();
const missing = english.filter((path) => !all.has(path === '' ? 'fr/' : `fr/${path}`));

if (missing.length > 0) {
  console.error(`Missing French routes:\n${missing.map((path) => `  /fr/${path}`).join('\n')}`);
  process.exit(1);
}

console.log(`French parity OK (${english.length} route pairs).`);
