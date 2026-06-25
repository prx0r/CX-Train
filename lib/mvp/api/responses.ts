import { NextResponse } from 'next/server';
import { getError, type ErrorCode } from './errors';

export interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  const body: ApiSuccess<T> = { ok: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body);
}

export function fail(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>,
  statusOverride?: number,
): NextResponse {
  const errorDef = getError(code);
  const body: ApiError = {
    ok: false,
    error: {
      code: errorDef.code,
      message: message || errorDef.message,
      details,
    },
  };
  return NextResponse.json(body, { status: statusOverride ?? errorDef.status });
}

export function failWithCustomCode(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): NextResponse {
  const body: ApiError = {
    ok: false,
    error: { code, message, details },
  };
  return NextResponse.json(body, { status });
}
