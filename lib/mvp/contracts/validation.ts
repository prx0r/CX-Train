export interface ContractValidationError {
  path: string;
  message: string;
}

export interface ContractValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: ContractValidationError[];
}

export function ok<T>(data: T): ContractValidationResult<T> {
  return { valid: true, data, errors: [] };
}

export function fail<T = never>(errors: ContractValidationError[]): ContractValidationResult<T> {
  return { valid: false, errors };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}
