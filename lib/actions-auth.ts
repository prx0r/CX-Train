/**
 * Callum GPT Action authentication.
 *
 * Shared auth helper for all /api/actions/* routes.
 * GPT Actions use Bearer token auth, not session cookies.
 */

export function verifyCallumActionAuth(request: Request): boolean {
  const expected = process.env.CALLUM_ACTIONS_KEY;

  if (!expected) {
    console.error('CALLUM_ACTIONS_KEY is not configured');
    return false;
  }

  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();

  return token.length > 0 && token === expected;
}

export function unauthorizedActionResponse(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
