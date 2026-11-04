import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/config';
import { buildTargets, checkUrl, renderReport, type LinkResult } from './lib/links';
import { createLoader } from './lib/load';

const CONCURRENCY = 5;

const targets = buildTargets(createLoader().projects());
const urls = [...targets.keys()];
const checked: Array<{ index: number; result: LinkResult }> = [];
let next = 0;

async function worker(): Promise<void> {
  while (next < urls.length) {
    const index = next++;
    checked.push({ index, result: await checkUrl(urls[index] as string) });
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

// Sort by slot rather than filling a pre-sized array: a worker that dies still
// leaves every completed result counted instead of a silent hole in the report.
const results = checked.sort((a, b) => a.index - b.index).map((entry) => entry.result);
const { content, dead } = renderReport(results, targets, new Date().toISOString().slice(0, 10));

writeFileSync(join(ROOT, 'link-report.md'), content);
writeFileSync(join(ROOT, '.dead-count'), String(dead));

console.log(`${dead}/${results.length} links failed.`);
