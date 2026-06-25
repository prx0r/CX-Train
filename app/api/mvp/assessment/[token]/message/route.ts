import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getAssessmentByToken, getSessionByAssessment, getMessages, makeId, getActiveScenario } from '@/lib/mvp/query';
import { appendSessionEvent } from '@/lib/mvp/events/eventLog';
import { runAiTask } from '@/lib/ai/provider';
import { getPackById } from '@/lib/mvp/sim/packRegistry';
import { buildAiCustomerContext } from '@/lib/mvp/sim/aiCustomer';
import { SimState } from '@/lib/mvp/sim/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
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
    const candidateMessage = (body.message || '').trim();
    if (!candidateMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const startedAtMs = body.started_at_ms || Date.now();
    const endedAtMs = body.ended_at_ms || Date.now();
    const durationMs = body.duration_ms || null;

    const db = getDb();

    /* Store candidate message */
    db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'candidate', ?, datetime('now'))`).run(makeId(), session.id, candidateMessage);

    appendSessionEvent({
      assessment_id: assessment.id,
      session_id: session.id,
      event_type: 'candidate_message',
      actor: 'candidate',
      text: candidateMessage,
      started_at_ms: startedAtMs,
      ended_at_ms: endedAtMs,
      duration_ms: durationMs,
    });

    /* Build conversation history */
    const priorMessages = getMessages(session.id);

    /* Determine AI caller prompt — use sim AI context for dashboard_sim, fallback for chat_call */
    const assessmentMode = (assessment as any).assessment_mode || 'chat_call';
    let systemMessage: string;

    if (assessmentMode === 'dashboard_sim') {
      /* Load current sim state and build AI customer context */
      const packId = (assessment as any).assessment_pack_id || 'pack-outlook-sim-v2';
      const pack = getPackById(packId);

      const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?').get(session.id) as any;
      const currentState: SimState = simSession
        ? JSON.parse(simSession.current_state_json)
        : pack.initialState;

      const ctx = buildAiCustomerContext(pack, currentState);
      systemMessage = ctx.systemPrompt;
    } else {
      /* Legacy chat_call mode — use scenario-based prompt */
      const scenario = assessment.scenario_id
        ? (db.prepare('SELECT * FROM scenarios WHERE id = ?').get(assessment.scenario_id) as any)
        : null;
      const hiddenFacts = scenario ? JSON.parse(scenario.hidden_facts_json) : {};
      const callerPrompt = scenario?.caller_behaviour_prompt || 'You are an MSP client calling for help.';

      systemMessage = `${callerPrompt}

HIDDEN FACTS (use these to answer truthfully, but do not volunteer them):
${JSON.stringify(hiddenFacts, null, 2)}

CRITICAL RULES:
- Do NOT reveal hidden facts unless the candidate directly asks about them
- If asked about hostname, reveal it
- If asked about urgency/deadline, mention the 30-minute meeting
- If asked about web/browser access, mention Outlook web works
- Stay in character: frustrated accountant Sarah Thompson from Alder & Co
- Keep responses concise (1-3 sentences)
- Never break character or mention that you are an AI`;
    }

    const conversation = [
      { role: 'system' as const, content: systemMessage },
      ...priorMessages.map(m => ({
        role: m.role === 'caller' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
    ];

    const result = await runAiTask('caller', {
      messages: conversation,
      temperature: 0.8,
      maxTokens: 512,
    });

    let callerReply: string;
    if (result.success) {
      callerReply = result.content;
    } else {
      console.warn('[MVP] Caller AI failed, using fallback:', result.error);
      callerReply = 'Alright, let me know if you need anything else. I really need to get this sorted before my meeting though.';
    }

    /* Store caller reply */
    db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'caller', ?, datetime('now'))`).run(makeId(), session.id, callerReply);

    appendSessionEvent({
      assessment_id: assessment.id,
      session_id: session.id,
      event_type: 'customer_message',
      actor: 'customer',
      text: callerReply,
      started_at_ms: Date.now(),
    });

    return NextResponse.json({
      reply: callerReply,
      model_used: result.model,
      success: result.success,
    });
  } catch (err) {
    console.error('[MVP] Message error:', err);
    return NextResponse.json({ error: 'Failed to process message', details: String(err) }, { status: 500 });
  }
}
