import { NextRequest, NextResponse } from 'next/server';
import { flagAnswer } from '@/lib/callum-actions';
import { verifyCallumActionAuth, unauthorizedActionResponse } from '@/lib/actions-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { answerId: string } }
) {
  if (!verifyCallumActionAuth(req)) return unauthorizedActionResponse();

  const body = await req.json();
  const { flag_type, comment, save_redacted_excerpt, redacted_excerpt } = body;
  if (!flag_type) return NextResponse.json({ error: 'Missing flag_type' }, { status: 400 });

  const excerpt = save_redacted_excerpt && redacted_excerpt ? redacted_excerpt : undefined;

  const result = flagAnswer(params.answerId, 'gpt-action-user', flag_type, comment, excerpt);

  return NextResponse.json({
    ...result,
    message: 'Flag created for manager review.',
    warning: save_redacted_excerpt && redacted_excerpt
      ? 'Redacted excerpt saved. Remove passwords, MFA codes, tokens, and personal data before saving.'
      : undefined,
  });
}
