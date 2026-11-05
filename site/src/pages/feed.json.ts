import type { APIRoute } from 'astro';
import { catalog } from '../lib/catalog';
import { changelog } from '../lib/changelog';
import { REPO_URL, SITE_URL } from '../lib/site';
import { renderJsonFeed } from '../../../scripts/lib/feed';

const projectNames = Object.fromEntries(
  catalog.projects.map((project) => [project.slug, project.name]),
);

const options = {
  siteUrl: SITE_URL,
  repoUrl: REPO_URL,
  title: 'Awesome Yoto — Changelog',
  description: 'New and updated projects in the Awesome Yoto directory.',
  projectNames,
};

export const GET: APIRoute = () =>
  new Response(renderJsonFeed(changelog.entries, options), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
