import { NextRequest, NextResponse } from 'next/server';
import { flagAnswer } from '@/lib/callum-actions';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(
  req: NextRequest,
  { params }: { params: { answerId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { flag_type, comment, save_redacted_excerpt, redacted_excerpt } = body;
  if (!flag_type) return NextResponse.json({ error: 'Missing flag_type' }, { status: 400 });

  const excerpt = save_redacted_excerpt && redacted_excerpt ? redacted_excerpt : undefined;
  if (save_redacted_excerpt && redacted_excerpt) {
    /* Warn about sensitive data in the response */
  }

  const result = flagAnswer(params.answerId, session.user.id, flag_type, comment, excerpt);

  return NextResponse.json({
    ...result,
    message: 'Flag created for manager review.',
    warning: save_redacted_excerpt && redacted_excerpt
      ? 'Redacted excerpt saved. Remove passwords, MFA codes, tokens, and personal data before saving.'
      : undefined,
  });
}
