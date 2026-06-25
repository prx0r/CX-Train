import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getAssessmentPack, getFullAssessment } from '@/lib/mvp/query';
import { getSimEvents } from '@/lib/mvp/sim/eventLog';
import { getSafeActions, getSafeVisibleState } from '@/lib/mvp/sim/packConfig';
import { buildTimeline } from '@/lib/mvp/sim/timeline';

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

    const assessmentMode = (full.assessment as any).assessment_mode;
    if (assessmentMode !== 'dashboard_sim') {
      return NextResponse.json({ error: 'Not a dashboard sim assessment' }, { status: 400 });
    }

    const packId = (full.assessment as any).assessment_pack_id;
    const pack = packId ? getAssessmentPack(packId) : null;
    if (!pack || !pack.sim_config_json) {
      return NextResponse.json({ error: 'Sim pack not found' }, { status: 404 });
    }

    const config = JSON.parse(pack.sim_config_json);
    const db = getDb();
    const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?').get(full.session.id) as any;
    const currentState = simSession ? JSON.parse(simSession.current_state_json) : {};

    const events = getSimEvents(full.session.id);
    const safeActions = getSafeActions(currentState, config.actions || []);
    const visibleState = getSafeVisibleState(currentState);

    return NextResponse.json({
      ok: true,
      data: {
        tools: config.tools || [],
        safe_actions: safeActions,
        visible_state: visibleState,
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
    console.error('[MVP] Get sim error:', err);
    return NextResponse.json({ error: 'Failed to get sim state' }, { status: 500 });
  }
}
