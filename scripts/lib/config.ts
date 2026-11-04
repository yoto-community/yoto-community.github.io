import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = join(ROOT, 'data');
export const PROJECTS_DIR = join(DATA_DIR, 'projects');
export const SITE_DIR = join(ROOT, 'site');
export const SITE_GENERATED_DIR = join(SITE_DIR, 'src/generated');
