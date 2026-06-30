import { verifyCallumActionAuth, unauthorizedActionResponse } from '@/lib/actions-auth';

/**
 * Health check for Callum Actions.
 * GET /api/actions/health
 *
 * Requires Bearer auth. Returns 200 if key is valid, 401 otherwise.
 */
export async function GET(request: Request) {
  if (!verifyCallumActionAuth(request)) {
    return unauthorizedActionResponse();
  }

  return Response.json({
    ok: true,
    service: 'callum-actions',
    auth: 'valid',
  });
}
