import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { applyChange } from '@/lib/taxonomy-db';

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = (await request.json()) as { proposal_id?: string };
  if (!body.proposal_id) {
    return NextResponse.json({ error: 'Missing proposal_id' }, { status: 400 });
  }
  const result = await applyChange(body.proposal_id);
  return NextResponse.json({ status: 'applied', item_count: result.item_count });
}
