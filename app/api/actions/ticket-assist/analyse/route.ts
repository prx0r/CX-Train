import { NextRequest, NextResponse } from 'next/server';
import { analyseTicket } from '@/lib/callum-actions';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/mvp/db';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const db = getDb();
  const msp = db.prepare(`
    SELECT o.id as org_id FROM msp_technicians t
    JOIN msp_organisations o ON o.id = t.msp_id
    WHERE t.user_id = ? AND t.active = 1 LIMIT 1
  `).get(session.user.id) as { org_id: string } | undefined;
  if (!msp) return NextResponse.json({ error: 'No MSP organisation found' }, { status: 400 });

  const body = await req.json();
  const { ticket_chain, client_name, user_question, mode } = body;
  if (!ticket_chain || !user_question) {
    return NextResponse.json({ error: 'Missing ticket_chain or user_question' }, { status: 400 });
  }

  try {
    const result = await analyseTicket({
      ticket_chain,
      client_name,
      user_question,
      mode: mode || 'triage',
    }, session.user.id, msp.org_id);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
