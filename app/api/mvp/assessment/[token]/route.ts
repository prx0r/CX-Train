import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/mvp/db';
import { resolveSimAssessment, SimResolutionError } from '@/lib/mvp/sim/resolver';
import { loadCandidateAnalysisForAssessment } from '@/lib/mvp/candidate/analysis';
import { resolveModeConfigSnapshot, workspaceModeForAssignmentType } from '@/lib/mvp/workspace/modeConfig';

function safeJsonParse(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

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
        const modeConfig = resolveModeConfigSnapshot(assignmentType, (full.assessment as any).mode_config_json);

        const rawAssessment = full.assessment as any;
        const packSnapshot = rawAssessment.pack_snapshot_json
          ? safeJsonParse(rawAssessment.pack_snapshot_json)
          : null;
        const isHiring = assignmentType === 'hiring_exam';
        const hiringPack = isHiring && packSnapshot?.customer ? packSnapshot as { id: string; title: string; customer: { name: string; company: string; openingLine: string; issue: string; role: string; temperament: string } } : null;

        const requesterName = hiringPack?.customer?.name
          || full.scenario?.caller_persona?.split(',')[0]?.trim()
          || 'Customer';
        const company = hiringPack?.customer?.company || '—';
        const ticketTitle = hiringPack?.customer?.issue || full.scenario?.title || 'Support Request';

        const ticketData: Record<string, unknown> = {
          id: 'INC-' + (rawAssessment.id?.slice(-6).toUpperCase() || '000000'),
          title: ticketTitle,
          requester_name: requesterName,
          company,
          department: hiringPack?.customer?.role || '—',
          severity: 'high',
          status: rawAssessment.status === 'invited' ? 'Open' : rawAssessment.status,
          description: full.messages?.[0]?.content || 'No description available',
        };

        const baseResponse: any = {
          ok: true,
          data: {
            assessment: {
              id: rawAssessment.id,
              title: rawAssessment.title,
              candidate_name: rawAssessment.candidate_name,
              status: rawAssessment.status,
              assignment_type: assignmentType,
              created_at: rawAssessment.created_at,
            },
            assignment_runtime: {
              shell: isHiring ? 'hiring' : 'service_desk',
              mode: workspaceModeForAssignmentType(assignmentType),
              mode_label: assignmentType === 'hiring_exam' ? 'Hiring Exam' : assignmentType === 'training_drill' ? 'Training Drill' : 'Assessment',
              capabilities,
              mode_config: modeConfig,
            },
            ticket: ticketData,
            call: {
              status: 'not_started',
              caller_name: requesterName,
              caller_company: company,
            },
            session_id: full.session?.id || null,
            messages: full.messages.map((m: any) => ({ role: m.role, content: m.content })),
            hiring_pack: hiringPack || null,
          },
        };

        /* Include analysis results if applicable */
        if (full.assessment.status === 'completed' || full.assessment.status === 'analysed') {
          const loadedAnalysis = loadCandidateAnalysisForAssessment(full.assessment.id);
          if (loadedAnalysis) {
            baseResponse.data.analysis = loadedAnalysis.analysis;
            baseResponse.data.candidate_analysis = loadedAnalysis.candidate_analysis;
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
      const loadedAnalysis = loadCandidateAnalysisForAssessment(view.assessment.id);
      if (loadedAnalysis) {
        baseResponse.data.analysis = loadedAnalysis.analysis;
        baseResponse.data.candidate_analysis = loadedAnalysis.candidate_analysis;
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
