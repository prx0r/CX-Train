import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { requireManagerTenant } from '@/lib/assessment-data';
import { createServerClient } from '@/lib/supabase';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const tenantId = await requireManagerTenant(user);
    const { id } = await params;
    const supabase = createServerClient();
    const { data: pack } = await supabase
      .from('assessment_packs')
      .select(`*, candidates!inner(id, name, email), sessions(*, scenarios(title, issue_family)), manager_reviews(*)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (!pack) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    const sessions = pack.sessions ?? [];
    const completed = sessions.filter((session: { candidate_ticket_text?: string | null }) => Boolean(session.candidate_ticket_text)).length;
    const scored = sessions.filter((session: { readiness_score?: number | null }) => session.readiness_score != null);
    const averageScore = scored.length
      ? Math.round(scored.reduce((sum: number, session: { readiness_score: number }) => sum + session.readiness_score, 0) / scored.length)
      : null;
    return NextResponse.json({ ...pack, completion_progress: { completed, total: pack.scenario_count }, average_score: averageScore });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: message === 'Unauthorized' ? message : 'Unable to load assessment' }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
