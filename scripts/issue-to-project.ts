import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stringify } from 'yaml';
import { PROJECTS_DIR } from './lib/config';
import { parseIssueForm, projectFromIssue } from './lib/issue';
import { createLoader } from './lib/load';
import { validateProjectFile } from './lib/schema';
import { validateRepository } from './lib/validate-repo';

function comment(issue: string, message: string) {
  try {
    execFileSync('gh', [
      'issue',
      'comment',
      issue,
      '--body',
      `Could not create the entry:\n\n\`\`\`\n${message}\n\`\`\``,
    ]);
  } catch (error) {
    // Commenting is best effort: the failing step is what matters for the workflow.
    console.error(error instanceof Error ? error.message : String(error));
  }
}

function main() {
  const body = process.env.ISSUE_BODY ?? '';
  const issue = process.env.ISSUE_NUMBER ?? '';
  const today = new Date().toISOString().slice(0, 10);
  const load = createLoader();

  try {
    const { slug, data } = projectFromIssue(parseIssueForm(body), today);

    // validateRepository treats two entries with the same slug as the same
    // project, so it cannot flag a resubmission that would overwrite a listed
    // entry: refuse that here instead of silently replacing the file.
    const path = join(PROJECTS_DIR, `${slug}.yml`);
    if (existsSync(path)) {
      throw new Error(
        `"${slug}" is already listed in data/projects; open a pull request to update it`,
      );
    }

    const schemaErrors = validateProjectFile(data);
    if (schemaErrors.length > 0) throw new Error(schemaErrors.join('\n'));

    // Validate the whole repository including the candidate entry: duplicate
    // name/URL against an existing project, unknown category or tag, slug
    // format and future dates are all reported here, on the new slug.
    const errors = validateRepository({
      today,
      categories: load.categories().map((category) => category.slug),
      tags: load.tags(),
      collections: load.collections().map((collection) => ({
        slug: collection.slug,
        items: collection.items,
      })),
      projects: [...load.projectFiles(), { slug, data }],
    });
    for (const [key, messages] of errors) {
      if (key === slug) throw new Error(messages.join('\n'));
    }

    writeFileSync(join(PROJECTS_DIR, `${slug}.yml`), stringify(data, { lineWidth: 0 }));
    writeFileSync('.issue-slug', `${slug}\n`);
    console.log(`Prepared data/projects/${slug}.yml`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (issue) comment(issue, message);
    process.exit(1);
  }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) main();
