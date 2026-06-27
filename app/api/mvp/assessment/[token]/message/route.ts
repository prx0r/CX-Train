import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getAssessmentByToken, getSessionByAssessment, getMessages, makeId } from '@/lib/mvp/query';
import { appendSessionEvent } from '@/lib/mvp/events/eventLog';
import { runAiTask } from '@/lib/ai/provider';
import { buildAiCustomerContext } from '@/lib/mvp/sim/aiCustomer';
import { SimState, SimPack } from '@/lib/mvp/sim/types';
import { getSnapshotFromAssessment, SimResolutionError } from '@/lib/mvp/sim/resolver';
import type { PackSnapshot } from '@/lib/mvp/sim/snapshot';

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
    const candidateMessage = (body.message || body.text || '').trim();
    if (!candidateMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const startedAtMs = body.started_at_ms || Date.now();
    const endedAtMs = body.ended_at_ms || Date.now();
    const inputSource = body.input_source || 'text';
    const audioMetadata = body.audio_metadata || null;

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
      input_source: inputSource as any,
      audio_metadata: audioMetadata,
    });

    /* Build conversation history */
    const priorMessages = getMessages(session.id);

    /* Determine if this is a sim pack assessment or a legacy chat call */
    const packId = (assessment as any).assessment_pack_id;
    let systemMessage: string;

    if (packId) {
      /* Sim pack assessment — use pack snapshot for AI caller context */
      let snapshot: PackSnapshot;
      try {
        snapshot = getSnapshotFromAssessment(assessment as unknown as Record<string, unknown>);
      } catch (err) {
        if (err instanceof SimResolutionError) {
          return NextResponse.json({ error: err.message }, { status: 500 });
        }
        throw err;
      }

      const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?')
        .get(session.id) as { current_state_json: string } | undefined;
      const currentState: SimState = simSession
        ? JSON.parse(simSession.current_state_json) as SimState
        : snapshot.initial_state;

      const ctx = buildAiCustomerContext({
        customer: {
          name: snapshot.customer.name,
          company: snapshot.customer.company,
          role: snapshot.customer.role,
          temperament: snapshot.customer.temperament as any,
          openingLine: snapshot.customer.opening_line,
        },
        callerBehavior: snapshot.caller_behavior,
        hiddenTruth: {
          rootCause: snapshot.hidden_truth.root_cause,
          correctFix: snapshot.hidden_truth.correct_fix,
          idealDiagnosticPath: snapshot.hidden_truth.ideal_diagnostic_path,
          factsOnlyRevealAfter: snapshot.hidden_truth.facts_only_reveal_after,
        },
      } as unknown as SimPack, currentState);
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
- Stay in character and be realistic
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
      input_source: inputSource,
    });
  } catch (err) {
    console.error('[MVP] Message error:', err);
    return NextResponse.json({ error: 'Failed to process message', details: String(err) }, { status: 500 });
  }
}
