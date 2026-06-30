import { NextRequest, NextResponse } from 'next/server';
import { createProposal } from '@/lib/callum-actions';
import { verifyCallumActionAuth, unauthorizedActionResponse } from '@/lib/actions-auth';

export async function POST(req: NextRequest) {
  if (!verifyCallumActionAuth(req)) return unauthorizedActionResponse();

  const body = await req.json();
  const { proposal_type, reason, proposed_change, client_name, taxonomy_item_id } = body;
  if (!proposal_type || !reason) {
    return NextResponse.json({ error: 'Missing proposal_type or reason' }, { status: 400 });
  }

  const validTypes = ['taxonomy_change', 'client_protocol_change', 'sla_note_change', 'global_playbook_change'];
  if (!validTypes.includes(proposal_type)) {
    return NextResponse.json({ error: `Invalid proposal_type` }, { status: 400 });
  }

  const result = createProposal(proposal_type, 'gpt-action-user', reason, proposed_change || {}, 'action-org');

  return NextResponse.json({
    proposal_id: result.proposal_id,
    status: result.status,
    message: 'Proposal created. A manager must approve it before it takes effect in the Callum dashboard.',
  });
}
