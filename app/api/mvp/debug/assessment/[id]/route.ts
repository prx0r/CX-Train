import { initTables, getDb } from '@/lib/mvp/db';
import { ok, fail } from '@/lib/mvp/api/responses';
import { buildMvpContext } from '@/lib/mvp/context/buildMvpContext';
import { getSessionEvents } from '@/lib/mvp/events/eventLog';
import { buildEvidenceTimeline, calculateTimingMetrics } from '@/lib/mvp/events/timeline';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    initTables();

    const result = buildMvpContext({
      assessmentId: params.id,
      include: {
        assessment: true,
        session: true,
        messages: true,
        ticket: true,
        standards: true,
        analysisRuns: true,
        results: true,
        feedback: true,
      },
    });

    if (!result.ok || !result.context) {
      return fail('ASSESSMENT_NOT_FOUND', result.error?.message || 'Assessment not found', { assessmentId: params.id });
    }

    const ctx = result.context;
    const assessment = ctx.assessment as any;
    const session = ctx.session as any;
    const ticket = ctx.ticket as any;
    const analysisRuns = ctx.analysisRuns as any[];
    const results = ctx.results as any[];
    const feedback = ctx.feedback as any;

    const integrity = {
      hasAssessment: true,
      hasSession: !!session,
      hasMessages: ctx.messages.length > 0,
      hasTicket: !!ticket,
      hasAnalysis: results.length > 0 || analysisRuns.some((r: any) => r.status === 'complete'),
      hasFeedback: !!feedback,
      hasFailedAnalysis: analysisRuns.some((r: any) => r.status === 'failed'),
      analysisStatus: analysisRuns.length > 0 ? analysisRuns[0]?.status || 'none' : 'none',
      orphanRisks: [] as string[],
    };

    if (!integrity.hasSession) integrity.orphanRisks.push('Assessment exists but has no session — candidate cannot proceed');
    if (!integrity.hasMessages) integrity.orphanRisks.push('Session exists but has no messages — candidate may not have started chat');
    if (!integrity.hasTicket) integrity.orphanRisks.push('Session exists but no ticket submitted — candidate may not have completed');
    if (!integrity.hasAnalysis) integrity.orphanRisks.push('No analysis result — analysis may not have been run or may have failed');
    if (integrity.hasFailedAnalysis) integrity.orphanRisks.push('Latest analysis run failed — check error details below');

    const messagesSafe = ctx.messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    }));

    return ok({
      assessment: assessment ? {
        id: assessment.id,
        title: assessment.title,
        candidate_name: assessment.candidate_name,
        candidate_email: assessment.candidate_email,
        status: assessment.status,
        created_at: assessment.created_at,
        completed_at: assessment.completed_at,
      } : null,
      session: session ? {
        id: session.id,
        assessment_id: session.assessment_id,
        status: session.status,
        started_at: session.started_at,
        ended_at: session.ended_at,
      } : null,
      messageCount: ctx.messages.length,
      messages: messagesSafe,
      ticket: ticket ? {
        id: ticket.id,
        text: ticket.candidate_ticket_text,
        created_at: ticket.created_at,
      } : null,
      standards: ctx.standards ? {
        id: (ctx.standards as any).id,
        required_ticket_fields: (ctx.standards as any).required_ticket_fields_json,
      } : null,
      analysisRuns: analysisRuns.map((r: any) => ({
        id: r.id,
        analysis_type: r.analysis_type,
        status: r.status,
        result_id: r.result_id,
        error_code: r.error_code || null,
        error_message: r.error_message || null,
        model: r.model,
        input_hash: r.input_hash?.substring(0, 16),
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      results: results.map((r: any) => {
        let structured = null;
        try {
          if (r.raw_model_json) structured = JSON.parse(r.raw_model_json);
        } catch {}
        return {
          id: r.id,
          overall_score: r.overall_score,
          readiness_label: r.readiness_label,
          summary: r.summary,
          raw_score_before_caps: structured?.deterministic_score?.rawScoreBeforeCaps ?? null,
          gate_hits: structured?.deterministic_score?.gateHits ?? [],
          rubric_version: structured?.deterministic_score?.rubricVersion ?? null,
          created_at: r.created_at,
        };
      }),
      feedback: feedback ? {
        id: feedback.id,
        manager_label: feedback.manager_label,
        manager_score: feedback.manager_score,
        notes: feedback.notes,
        created_at: feedback.created_at,
      } : null,
      // Evidence timeline from session_events
      events: session ? (() => {
        const evts = getSessionEvents(session.id);
        return {
          count: evts.length,
          timeline: buildEvidenceTimeline(evts),
          timingMetrics: calculateTimingMetrics(evts),
          raw: evts.slice(0, 50).map(e => ({
            sequence_index: e.sequence_index,
            event_type: e.event_type,
            actor: e.actor,
            label: e.label,
            result_text: e.result_text,
            started_at_ms: e.started_at_ms,
          })),
        };
      })() : { count: 0, timeline: [], timingMetrics: {}, raw: [] },
      integrity,
      warnings: result.warnings,
    });
  } catch (err) {
    return fail('UNKNOWN_ERROR', 'Failed to load assessment debug info', { error: String(err) });
  }
}
