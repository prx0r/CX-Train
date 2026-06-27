import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/mvp/db';
import { resolveSimAssessment, SimResolutionError } from '@/lib/mvp/sim/resolver';
import { buildCandidateAnalysis } from '@/lib/mvp/analysis/runBaseCallumAnalysis';
import { getPackById } from '@/lib/mvp/sim/packRegistry';
import { getDb } from '@/lib/mvp/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();

    let view;
    try {
      view = resolveSimAssessment(params.token);
    } catch (err) {
      if (err instanceof SimResolutionError && err.code === 'NOT_A_SIM_ASSESSMENT') {
        /* Fall through to legacy assessment loading */
        const { getFullAssessment } = await import('@/lib/mvp/query');
        const { getCapabilitiesForType } = await import('@/lib/mvp/assignment-types');
        const full = getFullAssessment(params.token, true);
        if (!full) {
          return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

        const assignmentType = (full.assessment as any).assignment_type || 'hiring_exam';
        const capabilities = { ...(getCapabilitiesForType(assignmentType) || { call: true, voice: true, textFallback: true, ticketPanel: true, remoteDesktop: false, tools: [], ticketComposer: true }) };

        const ticketData: Record<string, unknown> = {
          id: 'INC-' + (full.assessment.id?.slice(-6).toUpperCase() || '000000'),
          title: full.scenario?.title || 'Support Request',
          requester_name: full.scenario?.caller_persona?.split(',')[0]?.trim() || 'Customer',
          company: '—',
          department: '—',
          severity: 'high',
          status: full.assessment.status === 'invited' ? 'Open' : full.assessment.status,
          description: full.messages?.[0]?.content || 'No description available',
        };

        const baseResponse: any = {
          ok: true,
          data: {
            assessment: {
              id: full.assessment.id,
              title: full.assessment.title,
              candidate_name: full.assessment.candidate_name,
              status: full.assessment.status,
              assignment_type: assignmentType,
              created_at: full.assessment.created_at,
            },
            assignment_runtime: {
              shell: 'service_desk',
              mode_label: assignmentType === 'hiring_exam' ? 'Hiring Exam' : assignmentType === 'training_drill' ? 'Training Drill' : 'Assessment',
              capabilities,
            },
            ticket: ticketData,
            call: {
              status: 'not_started',
              caller_name: (ticketData.requester_name as string) || 'Customer',
              caller_company: (ticketData.company as string) || '',
            },
            session_id: full.session?.id || null,
            messages: full.messages.map(m => ({ role: m.role, content: m.content })),
          },
        };

        /* Include analysis results if applicable */
        if (full.assessment.status === 'completed' || full.assessment.status === 'analysed') {
          const db = getDb();
          const result = db.prepare(`
            SELECT r.overall_score, r.readiness_label, r.summary, r.strengths_json, r.weaknesses_json,
                   r.checkpoint_json, r.raw_model_json
            FROM assessment_results r
            WHERE r.assessment_id = ?
            ORDER BY r.created_at DESC LIMIT 1
          `).get(full.assessment.id) as any;

          if (result) {
            const analysisData = {
              status: 'analysed',
              overall_score: result.overall_score,
              readiness_label: result.readiness_label,
              summary: result.summary,
              strengths: result.strengths_json ? JSON.parse(result.strengths_json) : [],
              weaknesses: result.weaknesses_json ? JSON.parse(result.weaknesses_json) : [],
              checkpoints: result.checkpoint_json ? JSON.parse(result.checkpoint_json) : {},
              structured: result.raw_model_json ? JSON.parse(result.raw_model_json) : undefined,
            };
            baseResponse.data.analysis = analysisData;
            baseResponse.data.candidate_analysis = buildCandidateAnalysis(analysisData, null);
          }
        }

        return NextResponse.json(baseResponse);
      }
      throw err;
    }

    /* Build response from resolved view */
    const baseResponse: any = {
      ok: true,
      data: {
        assessment: view.assessment,
        assignment_runtime: view.assignment_runtime,
        ticket: view.ticket,
        call: view.call,
        session_id: view.session_id,
        messages: view.messages,
      },
    };

    if (view.sim) {
      baseResponse.pack_title = view.pack_title;
      baseResponse.sim = view.sim;
    }

    /* Include analysis results */
    if (view.assessment.status === 'completed' || view.assessment.status === 'analysed') {
      const db = getDb();
      const result = db.prepare(`
        SELECT r.overall_score, r.readiness_label, r.summary, r.strengths_json, r.weaknesses_json,
               r.checkpoint_json, r.raw_model_json
        FROM assessment_results r
        WHERE r.assessment_id = ?
        ORDER BY r.created_at DESC LIMIT 1
      `).get(view.assessment.id) as any;

      if (result) {
        const analysisData = {
          status: 'analysed',
          overall_score: result.overall_score,
          readiness_label: result.readiness_label,
          summary: result.summary,
          strengths: result.strengths_json ? JSON.parse(result.strengths_json) : [],
          weaknesses: result.weaknesses_json ? JSON.parse(result.weaknesses_json) : [],
          checkpoints: result.checkpoint_json ? JSON.parse(result.checkpoint_json) : {},
          structured: result.raw_model_json ? JSON.parse(result.raw_model_json) : undefined,
        };
        baseResponse.data.analysis = analysisData;
        baseResponse.data.candidate_analysis = buildCandidateAnalysis(analysisData, null);
      }
    }

    return NextResponse.json(baseResponse);
  } catch (err) {
    console.error('[MVP] Get assessment error:', err);
    if (err instanceof SimResolutionError) {
      if (err.code === 'NOT_A_SIM_ASSESSMENT') {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to get assessment' }, { status: 500 });
  }
}
