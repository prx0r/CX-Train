import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getAssessmentPack, getFullAssessment, makeId } from '@/lib/mvp/query';
import { applyAction } from '@/lib/mvp/sim/stateMachine';
import { insertSimEvent, getSimEvents } from '@/lib/mvp/sim/eventLog';
import { getSafeActions, getSafeVisibleState } from '@/lib/mvp/sim/packConfig';
import { buildTimeline } from '@/lib/mvp/sim/timeline';

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
    const timestampMs = body.timestamp_ms || Date.now();

    if (!actionId || !toolId) {
      return NextResponse.json({ error: 'action_id and tool_id required' }, { status: 400 });
    }

    const packId = (full.assessment as any).assessment_pack_id;
    const pack = packId ? getAssessmentPack(packId) : null;
    if (!pack || !pack.sim_config_json) {
      return NextResponse.json({ error: 'Sim pack not found' }, { status: 404 });
    }

    const config = JSON.parse(pack.sim_config_json);
    const action = config.actions?.find((a: any) => a.id === actionId && a.tool === toolId);
    if (!action) {
      return NextResponse.json({ error: `Action ${actionId} not found for tool ${toolId}` }, { status: 400 });
    }

    const db = getDb();
    const simSession = db.prepare('SELECT id, current_state_json FROM sim_sessions WHERE session_id = ?').get(full.session.id) as any;
    if (!simSession) {
      return NextResponse.json({ error: 'Sim session not found' }, { status: 404 });
    }

    const currentState = JSON.parse(simSession.current_state_json);

    // Check preconditions
    if (action.requires_state) {
      for (const [key, val] of Object.entries(action.requires_state)) {
        if (currentState[key] !== val) {
          return NextResponse.json({
            ok: false,
            error: `Action ${actionId} requires ${key}=${val} but current=${currentState[key]}`,
          }, { status: 400 });
        }
      }
    }

    // Apply action
    const result = applyAction(currentState, action);

    // Update sim session state
    db.prepare('UPDATE sim_sessions SET current_state_json = ? WHERE id = ?').run(
      JSON.stringify(result.state_after), simSession.id
    );

    // Insert action_performed event
    insertSimEvent({
      session_id: full.session.id,
      assessment_id: full.assessment.id,
      assessment_pack_id: packId,
      event_type: 'action_performed',
      actor: 'candidate',
      tool_id: toolId,
      action_id: actionId,
      label: action.label,
      result_text: action.result,
      state_before: result.state_before,
      state_after: result.state_after,
      timestamp_ms: timestampMs,
    });

    // Insert observation_returned event
    insertSimEvent({
      session_id: full.session.id,
      assessment_id: full.assessment.id,
      assessment_pack_id: packId,
      event_type: 'observation_returned',
      actor: 'system',
      tool_id: toolId,
      action_id: actionId,
      label: `${action.label} result`,
      result_text: action.result,
      timestamp_ms: timestampMs + 100,
    });

    // Insert red_flag_triggered if applicable
    if (action.red_flag) {
      insertSimEvent({
        session_id: full.session.id,
        assessment_id: full.assessment.id,
        assessment_pack_id: packId,
        event_type: 'red_flag_triggered',
        actor: 'system',
        tool_id: toolId,
        action_id: actionId,
        label: action.label,
        result_text: action.red_flag,
        state_after: result.state_after,
        timestamp_ms: timestampMs + 200,
      });
    }

    // Refresh events and build response
    const events = getSimEvents(full.session.id);
    const safeActions = getSafeActions(result.state_after, config.actions || []);
    const visibleState = getSafeVisibleState(result.state_after);

    return NextResponse.json({
      ok: true,
      data: {
        event: {
          action_id: result.action_id,
          label: result.label,
          result_text: result.result_text,
        },
        visible_state: visibleState,
        safe_actions: safeActions,
        timeline: buildTimeline(events).map(t => ({
          action_id: t.action_id,
          label: t.label,
          result_text: t.result_text,
          formatted_time: t.formatted_time,
          is_red_flag: t.is_red_flag,
        })),
      },
    });
  } catch (err) {
    console.error('[MVP] Sim action error:', err);
    return NextResponse.json({ error: 'Failed to process sim action' }, { status: 500 });
  }
}
