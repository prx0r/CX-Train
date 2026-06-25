import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getAssessmentPack, getFullAssessment } from '@/lib/mvp/query';
import { applyAction } from '@/lib/mvp/sim/stateMachine';
import { insertSimEvent } from '@/lib/mvp/sim/eventLog';
import { getVisibleActions, getVisibleState } from '@/lib/mvp/sim/safeProjection';
import { buildTimeline } from '@/lib/mvp/sim/timeline';
import { getOutlookWorkOfflinePack } from '@/lib/mvp/sim/packConfig';
import { SimState } from '@/lib/mvp/sim/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();
    const full = getFullAssessment(params.token, true);
    if (!full || !full.session) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const assessmentMode = (full.assessment as any).assessment_mode;
    if (assessmentMode !== 'dashboard_sim') {
      return NextResponse.json({ error: 'Not a dashboard sim assessment' }, { status: 400 });
    }

    const body = await request.json();
    const actionId = body.action_id as string;
    const toolId = body.tool_id as string;
    const startedAtMs = body.started_at_ms || Date.now();

    if (!actionId) {
      return NextResponse.json({ error: 'action_id required' }, { status: 400 });
    }

    const packId = (full.assessment as any).assessment_pack_id;
    const pack = packId ? getOutlookWorkOfflinePack() : getOutlookWorkOfflinePack();

    const action = pack.actions.find(a => a.id === actionId);
    if (!action) {
      return NextResponse.json({ error: `Action ${actionId} not found` }, { status: 400 });
    }

    const db = getDb();
    const simSession = db.prepare('SELECT id, current_state_json FROM sim_sessions WHERE session_id = ?').get(full.session.id) as any;
    if (!simSession) {
      return NextResponse.json({ error: 'Sim session not found' }, { status: 404 });
    }

    const currentState = JSON.parse(simSession.current_state_json) as SimState;

    /* Apply action through state machine */
    const { result, updatedState } = applyAction(currentState, action);

    if (result.redFlag && !result.phaseTransition && result.state_before === result.state_after) {
      /* Action was rejected — return precondition error */
      return NextResponse.json({
        ok: false,
        error: result.result_text,
      }, { status: 400 });
    }

    /* Update sim session state */
    db.prepare('UPDATE sim_sessions SET current_state_json = ? WHERE id = ?').run(
      JSON.stringify(updatedState), simSession.id
    );

    /* Log action_performed event */
    insertSimEvent({
      session_id: full.session.id,
      assessment_id: full.assessment.id,
      assessment_pack_id: packId,
      event_type: 'action_performed',
      actor: 'candidate',
      tool_id: action.tool,
      action_id: action.id,
      label: action.label,
      text: null,
      result_text: result.result_text,
      state_before: result.state_before,
      state_after: result.state_after,
      evidence_tags: result.evidenceTags.length > 0 ? result.evidenceTags : null,
      red_flag: result.redFlag,
      started_at_ms: startedAtMs,
    });

    /* Log observation_returned event */
    insertSimEvent({
      session_id: full.session.id,
      assessment_id: full.assessment.id,
      assessment_pack_id: packId,
      event_type: 'observation_returned',
      actor: 'system',
      tool_id: action.tool,
      action_id: action.id,
      label: `${action.label} result`,
      result_text: result.result_text,
      started_at_ms: startedAtMs + 100,
    });

    /* Log red flag */
    if (result.redFlag) {
      insertSimEvent({
        session_id: full.session.id,
        assessment_id: full.assessment.id,
        assessment_pack_id: packId,
        event_type: 'red_flag_triggered',
        actor: 'system',
        tool_id: action.tool,
        action_id: action.id,
        label: action.label,
        result_text: result.redFlag.message,
        state_after: result.state_after,
        red_flag: result.redFlag,
        started_at_ms: startedAtMs + 200,
      });
    }

    /* Log phase transition */
    if (result.phaseTransition) {
      insertSimEvent({
        session_id: full.session.id,
        assessment_id: full.assessment.id,
        assessment_pack_id: packId,
        event_type: 'observation_returned',
        actor: 'system',
        label: `Phase: ${updatedState.phase}`,
        result_text: `Transitioned to ${updatedState.phase} phase`,
        started_at_ms: startedAtMs + 150,
      });
    }

    /* Build safe response */
    const allEvents = db.prepare(
      'SELECT * FROM sim_events WHERE session_id = ? ORDER BY sequence_index ASC'
    ).all(full.session.id) as any[];

    const typedEvents = allEvents.map((e: any) => ({
      id: e.id,
      session_id: e.session_id,
      assessment_id: e.assessment_id,
      assessment_pack_id: e.assessment_pack_id,
      sequence: e.sequence_index,
      event_type: e.event_type,
      actor: e.actor,
      tool_id: e.tool_id,
      action_id: e.action_id,
      label: e.label,
      text: e.text,
      result_text: e.result_text,
      state_before_json: e.state_before_json ? JSON.parse(e.state_before_json) : null,
      state_after_json: e.state_after_json ? JSON.parse(e.state_after_json) : null,
      evidence_tags_json: e.evidence_tags_json ? JSON.parse(e.evidence_tags_json) : null,
      red_flag_json: e.red_flag_json ? JSON.parse(e.red_flag_json) : null,
      started_at_ms: e.timestamp_ms || e.started_at_ms,
      ended_at_ms: e.ended_at_ms || null,
      created_at: e.created_at,
    }));

    const visibleState = getVisibleState(updatedState);
    const safeActions = getVisibleActions(updatedState, pack.actions);

    return NextResponse.json({
      ok: true,
      data: {
        event: {
          action_id: result.action_id,
          label: result.label,
          result_text: result.result_text,
          red_flag: result.redFlag,
        },
        visible_state: visibleState,
        safe_actions: safeActions,
        phase: updatedState.phase,
        timeline: buildTimeline(typedEvents).map(t => ({
          sequence: t.sequence,
          event_type: t.event_type,
          actor: t.actor,
          formatted_time: t.formatted_time,
          label: t.label,
          result_text: t.result_text,
          is_red_flag: t.is_red_flag,
        })),
      },
    });
  } catch (err) {
    console.error('[MVP] Sim action error:', err);
    return NextResponse.json({ error: 'Failed to process sim action' }, { status: 500 });
  }
}
