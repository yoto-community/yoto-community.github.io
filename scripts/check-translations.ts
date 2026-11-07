import { pathToFileURL } from 'node:url';
import { createLoader } from './lib/load';
import {
  auditTranslations,
  formatCoverage,
  FR_FLOOR_DEFAULT,
  translationEntries,
  type TranslationProblem,
} from './lib/translations';

const LABELS: Record<TranslationProblem['kind'], string> = {
  missing: 'missing descriptionFr',
  'too-short': 'descriptionFr shorter than 20 characters',
  'too-long': 'descriptionFr longer than 180 characters',
};

/** Reads FR_FLOOR as a percentage, so a local run can lower the gate temporarily. */
function readFloor(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return FR_FLOOR_DEFAULT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
}

function report(problems: TranslationProblem[]): void {
  const groups = new Map<TranslationProblem['kind'], TranslationProblem[]>();
  for (const problem of problems) {
    const list = groups.get(problem.kind) ?? [];
    list.push(problem);
    groups.set(problem.kind, list);
  }

  for (const [kind, list] of groups) {
    console.error(`${LABELS[kind]} (${list.length}):`);
    for (const problem of list.sort((a, b) => a.slug.localeCompare(b.slug))) {
      const detail = problem.length === 0 ? '' : ` — ${problem.length} characters`;
      console.error(`  ${problem.slug}${detail}`);
    }
  }
}

function main(): void {
  const floor = readFloor(process.env.FR_FLOOR);
  if (floor === null) {
    console.error(
      `FR_FLOOR must be a percentage between 0 and 100, got "${process.env.FR_FLOOR}".`,
    );
    process.exit(1);
  }

  const load = createLoader();
  const entries = translationEntries(load.projectFiles());
  const loadErrors = load.errors();
  const audit = auditTranslations(entries);

  for (const error of loadErrors) console.error(`  ${error}`);
  if (audit.problems.length > 0) report(audit.problems);

  const summary = `${audit.translated}/${audit.total} French descriptions (${formatCoverage(
    audit.coverage,
  )}), floor ${floor}%.`;

  // Bounds violations are errors on their own: a 12-character description is not
  // a translation, even when the floor is lowered for a local experiment.
  const invalid = audit.problems.some((problem) => problem.kind !== 'missing');

  if (loadErrors.length > 0 || invalid || audit.coverage < floor) {
    console.error(`French coverage failed: ${summary}`);
    process.exit(1);
  }

  console.log(`French coverage OK: ${summary}`);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) main();
