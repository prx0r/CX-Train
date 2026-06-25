import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getFullAssessment } from '@/lib/mvp/query';
import { getOutlookWorkOfflinePack } from '@/lib/mvp/sim/packConfig';
import { getVisibleActions, getVisibleState } from '@/lib/mvp/sim/safeProjection';
import { buildTimeline } from '@/lib/mvp/sim/timeline';
import { SimState } from '@/lib/mvp/sim/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();
    const full = getFullAssessment(params.token, true);
    if (!full || !full.session) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const pack = getOutlookWorkOfflinePack();

    const db = getDb();
    const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?').get(full.session.id) as any;
    const currentState: SimState = simSession
      ? JSON.parse(simSession.current_state_json)
      : pack.initialState;

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
      evidence_tags_json: e.payload_json ? JSON.parse(e.payload_json) : null,
      red_flag_json: null,
      started_at_ms: e.timestamp_ms || e.started_at_ms,
      ended_at_ms: e.ended_at_ms || null,
      created_at: e.created_at,
    }));

    const visibleState = getVisibleState(currentState);
    const safeActions = getVisibleActions(currentState, pack.actions);

    return NextResponse.json({
      ok: true,
      data: {
        tools: pack.tools,
        safe_actions: safeActions,
        visible_state: visibleState,
        phase: currentState.phase,
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
    console.error('[MVP] Get sim error:', err);
    return NextResponse.json({ error: 'Failed to get sim state' }, { status: 500 });
  }
}
