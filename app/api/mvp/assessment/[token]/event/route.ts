import { NextRequest, NextResponse } from 'next/server';
import { initTables } from '@/lib/mvp/db';
import { getAssessmentByToken, getSessionByAssessment } from '@/lib/mvp/query';
import { appendSessionEvent } from '@/lib/mvp/events/eventLog';
import type { SessionEventType } from '@/lib/mvp/events/types';

const ALLOWED_EVENT_TYPES = new Set<SessionEventType>([
  'tool_opened',
  'action_performed',
  'ticket_note_updated',
]);

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    initTables();

    const assessment = getAssessmentByToken(params.token);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const session = getSessionByAssessment(assessment.id);
    if (!session || session.status !== 'in_progress') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    const body = await request.json();
    const eventType = (body.event_type || 'action_performed') as SessionEventType;

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: 'Unsupported event_type' }, { status: 400 });
    }

    const id = appendSessionEvent({
      assessment_id: assessment.id,
      session_id: session.id,
      event_type: eventType,
      actor: 'candidate',
      tool_id: body.tool_id || 'service_desk',
      action_id: body.action_id || null,
      label: body.label || null,
      text: body.text || null,
      payload: body.payload || null,
      started_at_ms: body.started_at_ms || Date.now(),
      ended_at_ms: body.ended_at_ms || null,
      duration_ms: body.duration_ms || null,
      input_source: 'text',
    });

    return NextResponse.json({ ok: true, event_id: id });
  } catch (err) {
    console.error('[MVP] Candidate event error:', err);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }
}
