import { NextRequest, NextResponse } from 'next/server';
import { analyseTicket } from '@/lib/callum-actions';
import { verifyActionsKey } from '@/lib/callum-auth';
import { getDb } from '@/lib/mvp/db';

export async function POST(req: NextRequest) {
  const auth = verifyActionsKey(req);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: 401 });

  const db = getDb();
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
