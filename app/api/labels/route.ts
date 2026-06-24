import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createServerClient();
    const { searchParams } = request.nextUrl;

    const labelType = searchParams.get('type');
    const labelKey = searchParams.get('key');
    const source = searchParams.get('source');
    const scenarioTitle = searchParams.get('scenario');
    const readiness = searchParams.get('readiness');
    const managerReviewed = searchParams.get('manager_reviewed');
    const sessionId = searchParams.get('session_id');
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

    let query = supabase
      .from('assessment_labels')
      .select('*, assessment_sessions:assessment_session_id(id, readiness_score, readiness_label, scenarios:scenario_id(title))', { count: 'exact' });

    if (labelType) {
      const types = labelType.split(',');
      query = query.in('label_type', types);
    }
    if (labelKey) query = query.eq('label_key', labelKey);
    if (source) query = query.eq('source', source);
    if (sessionId) query = query.eq('assessment_session_id', sessionId);

    if (scenarioTitle || readiness || managerReviewed) {
      let sessionQuery = supabase.from('sessions').select('id');
      if (scenarioTitle) {
        sessionQuery = sessionQuery.not('scenario_id', 'is', null);
      }
      if (readiness) sessionQuery = sessionQuery.eq('readiness_label', readiness);
      if (managerReviewed === 'true') {
        sessionQuery = sessionQuery.not('id', 'is', null);
      }
      const { data: filteredSessions } = await sessionQuery;
      if (filteredSessions?.length) {
        query = query.in('assessment_session_id', filteredSessions.map((s: { id: string }) => s.id));
      } else {
        return NextResponse.json({ labels: [], total: 0, offset, limit });
      }
    }

    const { data: labels, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: 'Unable to query labels' }, { status: 500 });

    return NextResponse.json({
      labels: labels ?? [],
      total: count ?? 0,
      offset,
      limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: message === 'Unauthorized' ? message : 'Unable to query labels' }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
