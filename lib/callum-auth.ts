/**
 * Callum Action API key authentication for ChatGPT Enterprise.
 * GPT Actions use Bearer token auth, not session cookies.
 */

export function verifyActionsKey(request: Request, keyOverride?: string): { valid: boolean; error?: string } {
  const actionsKey = keyOverride || process.env.CALLUM_ACTIONS_KEY || '';
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!actionsKey) {
    return { valid: false, error: 'CALLUM_ACTIONS_KEY not configured on server' };
  }

  if (!token || token !== actionsKey) {
    return { valid: false, error: 'Unauthorized' };
  }

  return { valid: true };
}
