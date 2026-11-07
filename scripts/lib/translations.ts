import type { ProjectFile } from './types';

export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 180;

/** The share of projects that must ship a French description, in percent. */
export const FR_FLOOR_DEFAULT = 100;

export interface TranslationEntry {
  slug: string;
  data: Partial<Pick<ProjectFile, 'descriptionFr'>>;
}

/** Adapts the loader output, whose YAML payload is still untrusted. */
export function translationEntries(
  files: Array<{ slug: string; data: unknown }>,
): TranslationEntry[] {
  return files.map(({ slug, data }) => ({
    slug,
    data: (data ?? {}) as Partial<Pick<ProjectFile, 'descriptionFr'>>,
  }));
}

export type TranslationProblemKind = 'missing' | 'too-short' | 'too-long';

export interface TranslationProblem {
  slug: string;
  kind: TranslationProblemKind;
  /** Length of the trimmed description, or 0 when it is missing. */
  length: number;
}

export interface TranslationAudit {
  total: number;
  translated: number;
  /** Percentage of entries with a usable French description, 0 to 100. */
  coverage: number;
  problems: TranslationProblem[];
}

/**
 * Counts usable French descriptions. A description counts only when it is a
 * string whose trimmed length fits the 20-180 bounds enforced by the schema, so
 * a whitespace-only value cannot inflate the coverage.
 */
export function auditTranslations(entries: TranslationEntry[]): TranslationAudit {
  const problems: TranslationProblem[] = [];
  let translated = 0;

  for (const { slug, data } of entries) {
    const raw = data.descriptionFr;
    const description = typeof raw === 'string' ? raw.trim() : '';

    if (description.length === 0) {
      problems.push({ slug, kind: 'missing', length: 0 });
      continue;
    }
    if (description.length < DESCRIPTION_MIN) {
      problems.push({ slug, kind: 'too-short', length: description.length });
      continue;
    }
    if (description.length > DESCRIPTION_MAX) {
      problems.push({ slug, kind: 'too-long', length: description.length });
      continue;
    }
    translated += 1;
  }

  const total = entries.length;
  return {
    total,
    translated,
    coverage: total === 0 ? 100 : (translated / total) * 100,
    problems,
  };
}

export function formatCoverage(coverage: number): string {
  return `${coverage.toFixed(1)}%`;
}
