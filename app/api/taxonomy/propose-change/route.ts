import { NextRequest, NextResponse } from 'next/server';
import { proposeChange, validateApiKey } from '@/lib/taxonomy-db';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const ok = await validateApiKey(apiKey);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.change_type || !body.proposed_by || !body.reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const proposal = await proposeChange({
      change_type: body.change_type,
      proposed_by: body.proposed_by,
      reason: body.reason,
      item: body.item,
      target_id: body.target_id,
    });

    return NextResponse.json({
      proposal_id: proposal.id,
      status: proposal.status || 'proposed',
      created_at: proposal.created_at,
    });
  } catch (err) {
    console.error('Taxonomy propose error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
