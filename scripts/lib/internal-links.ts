import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface LinkIssue {
  source: string;
  target: string;
}

export interface InternalLinkResult {
  checked: number;
  issues: LinkIssue[];
}

const ATTRIBUTES = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
const SKIP_PREFIXES = ['mailto:', 'tel:', 'javascript:', 'data:'];
const EXTERNAL_PREFIXES = ['/icons-catalogue/', '/podcast-catalogue/'];

export function extractLinks(html: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(ATTRIBUTES)) {
    const value = match[1];
    if (value) links.push(value);
  }
  return links;
}

/**
 * Maps a URL path to the file(s) that can satisfy it in the static build.
 * Astro uses directory-format output, so /projects/ -> dist/projects/index.html.
 */
export function resolveTargets(pathname: string, distDir: string): string[] {
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    path = pathname;
  }
  if (!path.startsWith('/')) path = `/${path}`;
  const base = join(distDir, path);

  if (path.endsWith('/')) return [join(base, 'index.html')];
  if (/\.[a-z0-9]+$/i.test(path)) return [base];
  return [join(base, 'index.html')];
}

function walkHtml(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkHtml(path);
    return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
  });
}

export function checkInternalLinks(
  distDir: string,
  siteOrigin: string,
  externalPrefixes: string[] = EXTERNAL_PREFIXES,
): InternalLinkResult {
  const issues: LinkIssue[] = [];
  let checked = 0;

  for (const page of walkHtml(distDir)) {
    const source = relative(distDir, page).split(sep).join('/');
    const pageUrl = new URL(source, siteOrigin);
    const html = readFileSync(page, 'utf8');

    for (const raw of extractLinks(html)) {
      const value = raw.trim();
      if (!value || value.startsWith('#')) continue;
      if (SKIP_PREFIXES.some((prefix) => value.toLowerCase().startsWith(prefix))) continue;

      let url: URL;
      try {
        url = new URL(value.replace(/&amp;/g, '&'), pageUrl);
      } catch {
        issues.push({ source, target: value });
        continue;
      }

      if (url.origin !== siteOrigin) continue;
      // The icon and podcast catalogues are separate GitHub Pages projects
      // served from the same origin, not files in this build.
      if (externalPrefixes.some((prefix) => url.pathname.startsWith(prefix))) continue;

      checked += 1;
      const targets = resolveTargets(url.pathname, distDir);
      if (!targets.some((target) => existsSync(target))) {
        issues.push({ source, target: value });
      }
    }
  }

  return { checked, issues };
}
