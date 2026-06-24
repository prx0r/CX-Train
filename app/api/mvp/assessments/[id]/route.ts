import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initTables();
    const full = getFullAssessment(params.id);
    if (!full) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    return NextResponse.json(full);
  } catch (err) {
    console.error('[MVP] Get assessment detail error:', err);
    return NextResponse.json({ error: 'Failed to get assessment detail' }, { status: 500 });
  }
}
