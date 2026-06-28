import { NextRequest } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getAssessmentByToken, getSessionByAssessment, getMessages, makeId } from '@/lib/mvp/query';
import { appendSessionEvent } from '@/lib/mvp/events/eventLog';
import { buildAiCustomerContext } from '@/lib/mvp/sim/aiCustomer';
import { getSnapshotFromAssessment, SimResolutionError } from '@/lib/mvp/sim/resolver';
import type { SimState, SimPack } from '@/lib/mvp/sim/types';
import type { PackSnapshot } from '@/lib/mvp/sim/snapshot';

function getBaseUrl(): string {
  return process.env.AI_BASE_URL || 'https://opencode.ai/zen/go/v1';
}

function getApiKey(): string {
  return process.env.AI_API_KEY || '';
}

function getModel(): string {
  return process.env.AI_CALLER_MODEL || 'deepseek-v4-flash';
}

function encodeSSE(data: string): string {
  return `data: ${data}\n\n`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    initTables();

    const assessment = getAssessmentByToken(params.token);
    if (!assessment) {
      return new Response(encodeSSE(JSON.stringify({ error: 'Assessment not found' })), {
        status: 404, headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const session = getSessionByAssessment(assessment.id);
    if (!session || session.status !== 'in_progress') {
      return new Response(encodeSSE(JSON.stringify({ error: 'Session not active' })), {
        status: 400, headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const body = await request.json();
    const candidateMessage = (body.message || body.text || '').trim();
    if (!candidateMessage) {
      return new Response(encodeSSE(JSON.stringify({ error: 'Message required' })), {
        status: 400, headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const startedAtMs = body.started_at_ms || Date.now();
    const inputSource = body.input_source || 'voice';
    const db = getDb();

    /* Store candidate message */
    db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
      VALUES (?, ?, 'candidate', ?, datetime('now'))`).run(makeId(), session.id, candidateMessage);

    appendSessionEvent({
      assessment_id: assessment.id, session_id: session.id,
      event_type: 'candidate_message', actor: 'candidate',
      text: candidateMessage, started_at_ms: startedAtMs,
    });

    /* Build conversation */
    const priorMessages = getMessages(session.id);
    const packId = (assessment as any).assessment_pack_id;
    let systemMessage: string;

    if (packId) {
      let snapshot: PackSnapshot;
      try {
        snapshot = getSnapshotFromAssessment(assessment as unknown as Record<string, unknown>);
      } catch (err) {
        const msg = err instanceof SimResolutionError ? err.message : 'Failed to load pack';
        return new Response(encodeSSE(JSON.stringify({ error: msg })), {
          status: 500, headers: { 'Content-Type': 'text/event-stream' },
        });
      }

      const simSession = db.prepare('SELECT current_state_json FROM sim_sessions WHERE session_id = ?')
        .get(session.id) as { current_state_json: string } | undefined;
      const currentState: SimState = simSession
        ? JSON.parse(simSession.current_state_json) as SimState
        : snapshot.initial_state;

      const ctx = buildAiCustomerContext({
        customer: {
          name: snapshot.customer.name, company: snapshot.customer.company,
          role: snapshot.customer.role, temperament: snapshot.customer.temperament as any,
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
      const scenario = assessment.scenario_id
        ? (db.prepare('SELECT * FROM scenarios WHERE id = ?').get(assessment.scenario_id) as any)
        : null;
      const hiddenFacts = scenario ? JSON.parse(scenario.hidden_facts_json) : {};
      const callerPrompt = scenario?.caller_behaviour_prompt || 'You are an MSP client calling for help.';
      systemMessage = `${callerPrompt}\nHIDDEN FACTS: ${JSON.stringify(hiddenFacts)}\nCRITICAL: Keep responses 1-2 sentences. Stay in character.`;
    }

    const conversation = [
      { role: 'system', content: systemMessage },
      ...priorMessages.map(m => ({
        role: m.role === 'caller' ? 'assistant' : 'user' as const,
        content: m.content,
      })),
    ];

    /* Streaming SSE response */
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullReply = '';

        try {
          const response = await fetch(`${getBaseUrl()}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getApiKey()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: getModel(),
              messages: conversation,
              temperature: 0.8,
              max_tokens: 512,
              stream: true,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            controller.enqueue(encoder.encode(encodeSSE(JSON.stringify({ error: `AI failed: ${errText}` }))));
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(encoder.encode(encodeSSE(JSON.stringify({ error: 'No response body' }))));
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const json = JSON.parse(jsonStr);
                const content = json.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullReply += content;
                  controller.enqueue(encoder.encode(encodeSSE(JSON.stringify({ token: content }))));
                }
              } catch { /* skip malformed */ }
            }
          }

          /* Store full reply */
          db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
            VALUES (?, ?, 'caller', ?, datetime('now'))`).run(makeId(), session.id, fullReply);

          appendSessionEvent({
            assessment_id: assessment.id, session_id: session.id,
            event_type: 'customer_message', actor: 'customer',
            text: fullReply, started_at_ms: Date.now(),
          });

          controller.enqueue(encoder.encode(encodeSSE(JSON.stringify({ done: true, fullReply }))));
          controller.close();
        } catch (err: any) {
          const fallback = 'Alright, let me know if you need anything else.';
          controller.enqueue(encoder.encode(encodeSSE(JSON.stringify({ token: fallback }))));
          controller.enqueue(encoder.encode(encodeSSE(JSON.stringify({ done: true, fullReply: fallback }))));
          controller.close();

          db.prepare(`INSERT INTO messages (id, session_id, role, content, created_at)
            VALUES (?, ?, 'caller', ?, datetime('now'))`).run(makeId(), session.id, fallback);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(encodeSSE(JSON.stringify({ error: String(err) })), {
      status: 500, headers: { 'Content-Type': 'text/event-stream' },
    });
  }
}
