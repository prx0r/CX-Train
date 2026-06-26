import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';
import { getPackById } from '@/lib/mvp/sim/packRegistry';
import { getVisibleActions, getVisibleState } from '@/lib/mvp/sim/safeProjection';
import { buildTimeline } from '@/lib/mvp/sim/timeline';
import { getSessionEvents } from '@/lib/mvp/events/eventLog';
import { getCapabilitiesForType } from '@/lib/mvp/assignment-types';
import { getOutlookWorkOfflinePack } from '@/lib/mvp/sim/packConfig';

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

    const assignmentType = (full.assessment as any).assignment_type || 'hiring_exam';
    const capabilities = getCapabilitiesForType(assignmentType);

    /* Build ticket data from scenario/pack info */
    let ticketData: Record<string, unknown> = {
      id: 'INC-' + (full.assessment.id?.slice(-6).toUpperCase() || '000000'),
      title: full.scenario?.title || 'Support Request',
      requester_name: full.scenario?.caller_persona?.split(',')[0]?.trim() || 'Customer',
      company: '—',
      department: '—',
      severity: 'high',
      status: full.assessment.status === 'invited' ? 'Open' : full.assessment.status,
      description: full.messages?.[0]?.content || 'No description available',
    };

    /* Try to get richer ticket data from pack */
    try {
      const packId = (full.assessment as any).assessment_pack_id;
      if (packId) {
        const pack = getPackById(packId);
        ticketData.requester_name = pack.customer.name;
        ticketData.company = pack.customer.company;
        ticketData.department = pack.customer.role;
        ticketData.description = pack.customer.openingLine;
      }
    } catch {}

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
          capabilities: capabilities || { call: true, voice: true, textFallback: true, ticketPanel: true, remoteDesktop: false, tools: [], ticketComposer: true },
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

    if (capabilities?.remoteDesktop) {
      const packId = (full.assessment as any).assessment_pack_id || 'pack-outlook-sim-v2';
      const pack = getPackById(packId);

      const db = getDb();
      const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?').get(full.session?.id) as any;
      const currentState = simSession
        ? JSON.parse(simSession.current_state_json)
        : pack.initialState;

      const canonicalEvents = full.session ? getSessionEvents(full.session.id) : [];
      const typedEvents = canonicalEvents.map((e: any) => ({
        ...e,
        sequence: e.sequence_index,
        state_before_json: e.state_before_json || null,
        state_after_json: e.state_after_json || null,
        started_at_ms: e.started_at_ms,
      }));

      baseResponse.pack_title = pack.title;
      baseResponse.sim = {
        tools: pack.tools,
        safe_actions: getVisibleActions(currentState, pack.actions),
        visible_state: getVisibleState(currentState),
        phase: currentState.phase,
        timeline: buildTimeline(typedEvents as any).map(t => ({
          sequence: t.sequence,
          event_type: t.event_type,
          actor: t.actor,
          formatted_time: t.formatted_time,
          label: t.label,
          result_text: t.result_text,
          is_red_flag: t.is_red_flag,
        })),
      };
    }

    return NextResponse.json(baseResponse);
  } catch (err) {
    console.error('[MVP] Get assessment error:', err);
    return NextResponse.json({ error: 'Failed to get assessment' }, { status: 500 });
  }
}
