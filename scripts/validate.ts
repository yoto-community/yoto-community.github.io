import { pathToFileURL } from 'node:url';
import { createLoader } from './lib/load';
import { validateWithSchema } from './lib/schema';
import { validateRepository } from './lib/validate-repo';

function main() {
  const load = createLoader();
  const categories = load.categories();
  const tags = load.tags();
  const collections = load.collections();
  const projects = load.projectFiles();
  const loadErrors = load.errors();

  const referentialErrors: string[] = [
    ...validateWithSchema('category', categories).map((error) => `categories.yml ${error}`),
    ...validateWithSchema('tag', tags).map((error) => `tags.yml ${error}`),
    ...validateWithSchema('collection', collections).map((error) => `collections.yml ${error}`),
  ];

  const errors = validateRepository({
    today: new Date().toISOString().slice(0, 10),
    categories: categories.map((category) => category.slug),
    tags,
    collections: collections.map((collection) => ({
      slug: collection.slug,
      items: collection.items,
    })),
    projects,
  });

  for (const error of loadErrors) console.error(`  ${error}`);
  for (const error of referentialErrors) console.error(`  ${error}`);
  for (const [slug, messages] of errors) {
    for (const message of messages) console.error(`  ${slug}: ${message}`);
  }
  if (loadErrors.length > 0 || referentialErrors.length > 0 || errors.size > 0) {
    console.error(`\nValidation failed.`);
    process.exit(1);
  }

  console.log(
    `Validation passed: ${projects.length} projects, ${categories.length} categories, ${tags.length} tags.`,
  );
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) main();
