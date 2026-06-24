import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();
    const full = getFullAssessment(params.token, true);
    if (!full) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }
    // Return only what the candidate needs — no hidden facts
    return NextResponse.json({
      id: full.assessment.id,
      title: full.assessment.title,
      candidate_name: full.assessment.candidate_name,
      status: full.assessment.status,
      session_id: full.session?.id || null,
      messages: full.messages.map(m => ({ role: m.role, content: m.content })),
      has_ticket: !!full.ticket,
      scenario_title: full.scenario?.title || null,
    });
  } catch (err) {
    console.error('[MVP] Get assessment error:', err);
    return NextResponse.json({ error: 'Failed to get assessment' }, { status: 500 });
  }
}
