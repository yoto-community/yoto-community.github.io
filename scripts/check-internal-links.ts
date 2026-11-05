import { join } from 'node:path';
import { checkInternalLinks } from './lib/internal-links';

const dist = join(process.cwd(), 'site/dist');
const siteOrigin = 'https://yoto-community.github.io';
const { checked, issues } = checkInternalLinks(dist, siteOrigin);

if (issues.length > 0) {
  console.error(`Broken internal links (${issues.length}):`);
  for (const issue of issues) console.error(`  ${issue.source}: ${issue.target}`);
  process.exit(1);
}

console.log(`Internal links OK: ${checked} checked.`);
