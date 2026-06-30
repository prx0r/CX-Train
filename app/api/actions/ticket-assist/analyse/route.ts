import { NextRequest, NextResponse } from 'next/server';
import { analyseTicket } from '@/lib/callum-actions';
import { verifyCallumActionAuth, unauthorizedActionResponse } from '@/lib/actions-auth';
import { initTables } from '@/lib/mvp/db';

export async function POST(req: NextRequest) {
  if (!verifyCallumActionAuth(req)) return unauthorizedActionResponse();
  initTables();

  const body = await req.json();
  const { ticket_chain, client_name, user_question, mode, user_identifier } = body;
  if (!ticket_chain || !user_question) {
    return NextResponse.json({ error: 'Missing ticket_chain or user_question' }, { status: 400 });
  }

  try {
    const result = await analyseTicket({
      ticket_chain,
      client_name,
      user_question,
      mode: mode || 'triage',
    }, user_identifier || 'gpt-action-user', 'action-org');

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
