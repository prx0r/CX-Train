export const ERROR_CODES = {
  ASSESSMENT_NOT_FOUND: {
    code: 'ASSESSMENT_NOT_FOUND',
    message: 'The specified assessment was not found.',
    status: 404,
  },
  SESSION_NOT_FOUND: {
    code: 'SESSION_NOT_FOUND',
    message: 'No session found for this assessment.',
    status: 404,
  },
  TOKEN_NOT_FOUND: {
    code: 'TOKEN_NOT_FOUND',
    message: 'The invite token is invalid or has expired.',
    status: 404,
  },
  TICKET_NOT_FOUND: {
    code: 'TICKET_NOT_FOUND',
    message: 'No ticket has been submitted for this assessment.',
    status: 400,
  },
  NO_MESSAGES_FOUND: {
    code: 'NO_MESSAGES_FOUND',
    message: 'No messages found for this session.',
    status: 400,
  },
  STANDARDS_NOT_FOUND: {
    code: 'STANDARDS_NOT_FOUND',
    message: 'No manager standards found. Run mvp:init-db first.',
    status: 404,
  },
  ANALYSIS_CONTEXT_INCOMPLETE: {
    code: 'ANALYSIS_CONTEXT_INCOMPLETE',
    message: 'Cannot run analysis: missing required data (ticket, messages, or criteria).',
    status: 400,
  },
  AI_PROVIDER_MISSING_KEY: {
    code: 'AI_PROVIDER_MISSING_KEY',
    message: 'AI provider API key is not configured.',
    status: 503,
  },
  AI_PROVIDER_FAILED: {
    code: 'AI_PROVIDER_FAILED',
    message: 'AI provider returned an error.',
    status: 502,
  },
  AI_INVALID_JSON: {
    code: 'AI_INVALID_JSON',
    message: 'AI response could not be parsed as valid JSON.',
    status: 502,
  },
  DB_WRITE_FAILED: {
    code: 'DB_WRITE_FAILED',
    message: 'Failed to write to database.',
    status: 500,
  },
  DB_READ_FAILED: {
    code: 'DB_READ_FAILED',
    message: 'Failed to read from database.',
    status: 500,
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed.',
    status: 400,
  },
  NOT_IMPLEMENTED: {
    code: 'NOT_IMPLEMENTED',
    message: 'This feature is not yet implemented.',
    status: 501,
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred.',
    status: 500,
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function getError(code: ErrorCode): { code: string; message: string; status: number } {
  return ERROR_CODES[code];
}
