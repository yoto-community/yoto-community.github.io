import type { Category, Collection, Project } from './types';

export interface CatalogInput {
  categories: Category[];
  projects: Project[];
  tags: string[];
  collections: Collection[];
}

export function buildCatalog(input: CatalogInput) {
  return {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    categories: input.categories,
    tags: input.tags,
    collections: input.collections,
    projects: input.projects,
  };
}
