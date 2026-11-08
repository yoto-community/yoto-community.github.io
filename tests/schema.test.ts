import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { validateProjectFile } from '../scripts/lib/schema';

const valid = parse(readFileSync('tests/fixtures/project.valid.yml', 'utf8'));

describe('validateProjectFile', () => {
  it('accepts a valid project', () => {
    expect(validateProjectFile(valid)).toEqual([]);
  });

  it('rejects a non-HTTPS URL', () => {
    expect(validateProjectFile({ ...valid, url: 'http://example.com' }).join(' ')).toContain(
      '/url',
    );
  });

  it('rejects an unknown status', () => {
    expect(validateProjectFile({ ...valid, status: 'dead' }).join(' ')).toContain('/status');
  });

  it('rejects a deprecated project without deprecatedBy', () => {
    expect(validateProjectFile({ ...valid, status: 'deprecated' }).join(' ')).toContain(
      'deprecatedBy',
    );
  });

  it('accepts a project that omits optional fields', () => {
    const { featured: _ignored, ...minimal } = valid;
    expect(validateProjectFile(minimal)).toEqual([]);
  });

  it('rejects featured without featuredReason', () => {
    expect(validateProjectFile({ ...valid, featured: true }).join(' ')).toContain('featuredReason');
  });

  it('rejects an unknown field', () => {
    expect(validateProjectFile({ ...valid, colour: 'red' }).join(' ')).toContain('additional');
  });

  it('rejects an invalid authorGithub', () => {
    expect(validateProjectFile({ ...valid, authorGithub: 'not a handle' }).join(' ')).toContain(
      '/authorGithub',
    );
  });

  it('rejects a description shorter than 20 characters', () => {
    expect(validateProjectFile({ ...valid, description: 'Too short.' }).join(' ')).toContain(
      '/description',
    );
  });
});
