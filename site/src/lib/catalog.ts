import raw from '../generated/catalog.json';
import type { Category, Collection, Project } from '../../../scripts/lib/types';

export interface Catalog {
  schemaVersion: 1;
  generatedAt: string;
  categories: Category[];
  tags: string[];
  collections: Collection[];
  projects: Project[];
}

export const catalog = raw as unknown as Catalog;
