import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse } from 'yaml';
import { DATA_DIR } from './config';
import type { Category, Collection, Project, ProjectFile, ProjectMeta } from './types';

export interface MetaFile {
  updatedAt: string;
  projects: Record<string, ProjectMeta>;
}

export function createLoader(baseDir: string = DATA_DIR) {
  const errors = new Set<string>();

  const label = (path: string): string =>
    relative(dirname(baseDir), resolve(baseDir, path)) || path;

  const report = (path: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    errors.add(`${label(path)}: ${message}`);
  };

  const read = <T>(file: string, fallback: T): T => {
    try {
      return parse(readFileSync(join(baseDir, file), 'utf8')) as T;
    } catch (error) {
      report(file, error);
      return fallback;
    }
  };

  const categories = (): Category[] =>
    read<Category[]>('categories.yml', []).sort((a, b) => a.order - b.order);

  const tags = (): string[] => read<string[]>('tags.yml', []);

  const collections = (): Collection[] => read<Collection[]>('collections.yml', []);

  const projectFiles = (): Array<{ slug: string; data: unknown }> => {
    let files: string[];
    try {
      files = readdirSync(join(baseDir, 'projects'));
    } catch (error) {
      report('projects', error);
      return [];
    }
    return files
      .filter((file) => file.endsWith('.yml'))
      .sort()
      .flatMap((file) => {
        try {
          const data: unknown = parse(readFileSync(join(baseDir, 'projects', file), 'utf8'));
          return [{ slug: file.replace(/\.yml$/, ''), data }];
        } catch (error) {
          report(join('projects', file), error);
          return [];
        }
      });
  };

  const meta = (): MetaFile => {
    const path = join(baseDir, '.meta.json');
    if (!existsSync(path)) return { updatedAt: '', projects: {} };
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<MetaFile>;
      return { updatedAt: parsed.updatedAt ?? '', projects: parsed.projects ?? {} };
    } catch (error) {
      report('.meta.json', error);
      return { updatedAt: '', projects: {} };
    }
  };

  const projects = (): Project[] => {
    const cache = meta();
    return projectFiles()
      .map(({ slug, data }) => ({
        ...(data as ProjectFile),
        slug,
        meta: cache.projects[slug],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  };

  const errorsList = (): string[] => [...errors];

  return { categories, tags, collections, projectFiles, meta, projects, errors: errorsList };
}
