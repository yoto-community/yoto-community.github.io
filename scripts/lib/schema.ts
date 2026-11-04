import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT } from './config';

let validator: ReturnType<Ajv2020['compile']> | undefined;

function getValidator() {
  if (validator) return validator;
  const schema = JSON.parse(readFileSync(join(ROOT, 'schema/project.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  validator = ajv.compile(schema);
  return validator;
}

export function validateProjectFile(raw: unknown): string[] {
  const validate = getValidator();
  if (validate(raw)) return [];
  return (validate.errors ?? []).map((error) => {
    const path = error.instancePath || '/';
    const extra =
      error.keyword === 'additionalProperties'
        ? ` (${String((error.params as { additionalProperty?: string }).additionalProperty)})`
        : '';
    return `${path} ${error.message}${extra}`;
  });
}

export function validateWithSchema(name: string, raw: unknown): string[] {
  const schema = JSON.parse(readFileSync(join(ROOT, `schema/${name}.schema.json`), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (validate(raw)) return [];
  return (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`);
}
