export type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface FieldSchema {
  type: SchemaType;
  description?: string;
  optional?: boolean;
  fields?: Record<string, FieldSchema>;
  itemType?: FieldSchema;
}

export type InferType<S extends Record<string, FieldSchema>> = {
  [K in keyof S]: S[K]['optional'] extends true
    ? S[K]['type'] extends 'string' ? string | undefined
      : S[K]['type'] extends 'number' ? number | undefined
        : S[K]['type'] extends 'boolean' ? boolean | undefined
          : S[K]['type'] extends 'object' ? (S[K]['fields'] extends Record<string, FieldSchema> ? InferType<S[K]['fields']> : Record<string, unknown>) | undefined
            : S[K]['type'] extends 'array' ? (S[K]['itemType'] extends FieldSchema ? unknown[] | undefined : unknown[] | undefined)
              : undefined
    : S[K]['type'] extends 'string' ? string
      : S[K]['type'] extends 'number' ? number
        : S[K]['type'] extends 'boolean' ? boolean
          : S[K]['type'] extends 'object' ? (S[K]['fields'] extends Record<string, FieldSchema> ? InferType<S[K]['fields']> : Record<string, unknown>)
            : S[K]['type'] extends 'array' ? (S[K]['itemType'] extends FieldSchema ? unknown[] : unknown[])
              : never;
};

export interface ValidationError {
  path: string;
  message: string;
}

export function validateObject<T extends Record<string, FieldSchema>>(
  schema: T,
  input: unknown,
): { valid: true; data: InferType<T> } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: [{ path: '', message: 'Expected an object' }] };
  }

  const obj = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema)) {
    const value = obj[key];

    if (value === undefined || value === null) {
      if (field.optional) continue;
      errors.push({ path: key, message: `Required field "${key}" is missing` });
      continue;
    }

    const fieldResult = validateField(key, field, value);
    if (fieldResult.valid === false) {
      errors.push(...fieldResult.errors);
    } else {
      result[key] = fieldResult.data;
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: result as InferType<T> };
}

function validateField(
  path: string,
  field: FieldSchema,
  value: unknown,
): { valid: true; data: unknown } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push({ path, message: `Expected string, got ${typeof value}` });
      }
      return errors.length > 0 ? { valid: false, errors } : { valid: true, data: value };

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push({ path, message: `Expected number, got ${typeof value}` });
      }
      return errors.length > 0 ? { valid: false, errors } : { valid: true, data: value };

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({ path, message: `Expected boolean, got ${typeof value}` });
      }
      return errors.length > 0 ? { valid: false, errors } : { valid: true, data: value };

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push({ path, message: 'Expected an object' });
        return { valid: false, errors };
      }
      if (field.fields) {
        return validateObject(field.fields, value);
      }
      return { valid: true, data: value };

    case 'array':
      if (!Array.isArray(value)) {
        errors.push({ path, message: 'Expected an array' });
        return { valid: false, errors };
      }
      return { valid: true, data: value };
  }

  return { valid: false, errors: [{ path, message: `Unknown type: ${field.type}` }] };
}

export function describeSchema(schema: Record<string, FieldSchema>): string {
  const lines: string[] = [];
  for (const [key, field] of Object.entries(schema)) {
    const required = field.optional ? ' (optional)' : '';
    const desc = field.description ? ` — ${field.description}` : '';
    lines.push(`  ${key}: ${field.type}${required}${desc}`);
  }
  return lines.join('\n');
}
