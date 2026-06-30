import { NextRequest, NextResponse } from 'next/server';
import { createProposal } from '@/lib/callum-actions';
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
  const { proposal_type, reason, payload } = body;
  if (!proposal_type || !reason) {
    return NextResponse.json({ error: 'Missing proposal_type or reason' }, { status: 400 });
  }

  const validTypes = ['taxonomy_change', 'client_protocol_change', 'sla_note_change', 'global_playbook_change'];
  if (!validTypes.includes(proposal_type)) {
    return NextResponse.json({ error: `Invalid proposal_type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  }

  const result = createProposal(proposal_type, session.user.name || session.user.id, reason, payload || {}, msp.org_id);

  return NextResponse.json({
    ...result,
    message: 'Proposal created. A manager must approve it before it takes effect.',
  });
}
