import { NextRequest, NextResponse } from 'next/server';
import { initTables, getDb } from '@/lib/mvp/db';
import { getFullAssessment, getAssessmentPack } from '@/lib/mvp/query';
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
    if (!full) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const assessmentMode = (full.assessment as any).assessment_mode || 'chat_call';

    const baseResponse: any = {
      id: full.assessment.id,
      title: full.assessment.title,
      candidate_name: full.assessment.candidate_name,
      status: full.assessment.status,
      session_id: full.session?.id || null,
      messages: full.messages.map(m => ({ role: m.role, content: m.content })),
      has_ticket: !!full.ticket,
      scenario_title: full.scenario?.title || null,
      assessment_mode: assessmentMode,
    };

    // For dashboard_sim, include safe sim data
    if (assessmentMode === 'dashboard_sim') {
      const packId = (full.assessment as any).assessment_pack_id;
      const pack = packId ? getAssessmentPack(packId) : null;

      if (pack && pack.sim_config_json) {
        const config = JSON.parse(pack.sim_config_json);
        const db = getDb();
        const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?').get(full.session?.id) as any;
        const currentState = simSession ? JSON.parse(simSession.current_state_json) : {};

        const events = full.session ? getSimEvents(full.session.id) : [];
        const safeActions = getSafeActions(currentState, config.actions || []);
        const visibleState = getSafeVisibleState(currentState);

        baseResponse.pack_title = pack.title;
        baseResponse.sim = {
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
        };
      }
    }

    return NextResponse.json(baseResponse);
  } catch (err) {
    console.error('[MVP] Get assessment error:', err);
    return NextResponse.json({ error: 'Failed to get assessment' }, { status: 500 });
  }
}
