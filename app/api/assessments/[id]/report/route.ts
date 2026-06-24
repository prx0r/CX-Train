import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { requireManagerTenant, safeScenario } from '@/lib/assessment-data';
import { createServerClient } from '@/lib/supabase';
import { getRubric } from '@/lib/evaluation/scenarios';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const tenantId = await requireManagerTenant(user);
    const { id } = await params;
    const supabase = createServerClient();

    const { data: pack } = await supabase
      .from('assessment_packs')
      .select(`*, candidates!inner(id, name, email)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (!pack) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

    const { data: sessions } = await supabase
      .from('sessions')
      .select(`*, scenarios(*)`)
      .eq('assessment_pack_id', id)
      .order('created_at');

    const { data: reviews } = await supabase
      .from('manager_reviews')
      .select('*')
      .eq('assessment_pack_id', id)
      .order('created_at', { ascending: false });

    const { data: labels } = await supabase
      .from('assessment_labels')
      .select('*')
      .eq('assessment_session_id', id)
      .in('label_type', ['skill', 'risk', 'outcome']);

    const callReports = await Promise.all((sessions ?? []).map(async (session) => {
      const scenario = Array.isArray(session.scenarios) ? session.scenarios[0] : session.scenarios;
      const rubric = getRubric(scenario?.title ?? '', scenario?.rubric ?? []);

      const { data: transcripts } = await supabase
        .from('assessment_call_transcripts')
        .select('id, raw_transcript, source, created_at')
        .eq('assessment_session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const transcriptId = transcripts?.[0]?.id;

      const { data: evidence } = transcriptId ? await supabase
        .from('assessment_evidence')
        .select('*')
        .eq('evaluation_id', transcriptId)
        .in('evaluation_id', (
          await supabase.from('assessment_call_evaluations').select('id').eq('transcript_id', transcriptId)
        ).data?.map((e: { id: string }) => e.id) ?? [])
        : { data: [] };

      const { data: sessionLabels } = transcriptId ? await supabase
        .from('assessment_labels')
        .select('*')
        .eq('assessment_session_id', session.id)
        : { data: [] };

      return {
        sessionId: session.id,
        scenarioTitle: scenario?.title ?? '',
        issueFamily: scenario?.issue_family ?? '',
        transcript: transcripts?.[0] ?? null,
        rubric,
        score: session.score,
        readinessScore: session.readiness_score,
        readinessLabel: session.readiness_label,
        ticketText: session.candidate_ticket_text,
        ticketScore: session.ticket_score,
        evidence: evidence ?? [],
        labels: sessionLabels ?? [],
        scoreBreakdown: session.score_breakdown,
        feedbackText: session.feedback_text,
        managerReview: (reviews ?? []).find((r) => r.session_id === session.id) ?? null,
      };
    }));

    const allLabels = labels ?? [];
    const riskLabelSet = [...new Set(allLabels.filter((l) => l.label_type === 'risk').map((l) => l.label_key))] as string[];
    const skillLabelSet = [...new Set(allLabels.filter((l) => l.label_type === 'skill').map((l) => l.label_key))] as string[];

    const report = {
      assessment: {
        id: pack.id,
        title: pack.title,
        mode: pack.mode,
        status: pack.status,
        difficulty: pack.difficulty,
        createdAt: pack.created_at,
        completedAt: pack.completed_at,
        finalRecommendation: pack.final_recommendation,
      },
      candidate: {
        id: pack.candidates?.id ?? '',
        name: pack.candidates?.name ?? '',
        email: pack.candidates?.email ?? null,
      },
      summary: {
        completedCalls: (sessions ?? []).filter((s) => s.candidate_ticket_text).length,
        totalCalls: pack.scenario_count,
        averageScore: (sessions ?? []).filter((s) => s.readiness_score != null).length
          ? Math.round((sessions ?? []).reduce((sum, s) => sum + (s.readiness_score ?? 0), 0) / (sessions ?? []).filter((s) => s.readiness_score != null).length)
          : null,
        riskLabels: riskLabelSet,
        skillLabels: skillLabelSet,
      },
      calls: callReports,
      managerReviews: reviews ?? [],
    };

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: message === 'Unauthorized' ? message : 'Unable to load report' }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
