import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../scripts/lib/config';
import { createLoader } from '../scripts/lib/load';
import {
  auditTranslations,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  formatCoverage,
  translationEntries,
} from '../scripts/lib/translations';

const VALID = 'Une phrase factuelle qui décrit le projet pour un parent.';

const entries = (descriptions: unknown[]) =>
  descriptions.map((descriptionFr, index) => ({
    slug: `project-${index}`,
    data: { descriptionFr } as { descriptionFr?: string },
  }));

describe('auditTranslations', () => {
  it('counts an empty list as fully translated', () => {
    expect(auditTranslations([])).toEqual({
      total: 0,
      translated: 0,
      coverage: 100,
      problems: [],
    });
  });

  it('reports full coverage when every entry has a valid description', () => {
    const audit = auditTranslations(entries([VALID, VALID]));
    expect(audit).toMatchObject({ total: 2, translated: 2, coverage: 100, problems: [] });
  });

  it('treats a missing, empty or whitespace-only description as missing', () => {
    const audit = auditTranslations(entries([undefined, '', '   ', '\n\t']));
    expect(audit.translated).toBe(0);
    expect(audit.problems.map((problem) => problem.kind)).toEqual([
      'missing',
      'missing',
      'missing',
      'missing',
    ]);
  });

  it('rejects a description shorter than the schema minimum', () => {
    const short = 'Trop court.';
    expect(short.length).toBeLessThan(DESCRIPTION_MIN);
    const audit = auditTranslations(entries([short]));
    expect(audit.problems).toEqual([{ slug: 'project-0', kind: 'too-short', length: 11 }]);
    expect(audit.translated).toBe(0);
  });

  it('rejects a description longer than the schema maximum', () => {
    const long = 'a'.repeat(DESCRIPTION_MAX + 1);
    const audit = auditTranslations(entries([long]));
    expect(audit.problems).toEqual([
      { slug: 'project-0', kind: 'too-long', length: DESCRIPTION_MAX + 1 },
    ]);
  });

  it('measures the trimmed description, so padding cannot pass or fail it', () => {
    const padded = `   ${VALID}   `;
    const audit = auditTranslations(entries([padded]));
    expect(audit.problems).toEqual([]);
    expect(audit.translated).toBe(1);
  });

  it('treats a non-string value as missing instead of crashing', () => {
    const audit = auditTranslations(entries([42]));
    expect(audit.problems).toEqual([{ slug: 'project-0', kind: 'missing', length: 0 }]);
  });

  it('rounds coverage to one decimal for display', () => {
    const audit = auditTranslations(entries([VALID, VALID, undefined]));
    expect(audit.coverage).toBeCloseTo(200 / 3, 10);
    expect(formatCoverage(audit.coverage)).toBe('66.7%');
  });
});

describe('description bounds', () => {
  it('matches the JSON schema, so the audit and validation cannot drift', () => {
    const schema = JSON.parse(readFileSync(join(ROOT, 'schema/project.schema.json'), 'utf8')) as {
      properties: { descriptionFr: { minLength: number; maxLength: number } };
    };
    expect(schema.properties.descriptionFr.minLength).toBe(DESCRIPTION_MIN);
    expect(schema.properties.descriptionFr.maxLength).toBe(DESCRIPTION_MAX);
  });
});

describe('repository translations', () => {
  it('ships a French description for every project', () => {
    const audit = auditTranslations(translationEntries(createLoader().projectFiles()));
    expect(audit.problems).toEqual([]);
    expect(audit.coverage).toBe(100);
  });
});
