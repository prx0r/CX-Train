import { NextRequest, NextResponse } from 'next/server';
import { getDb, initTables } from '@/lib/mvp/db';
import { getFullAssessment, getActiveCriteria, getActiveScenario, makeId } from '@/lib/mvp/query';
import { runAiTask, parseJsonResponse } from '@/lib/ai/provider';

interface AnalysisCheckpoints {
  confirmed_user: boolean;
  confirmed_company: boolean;
  captured_device_or_hostname: boolean;
  clarified_issue: boolean;
  asked_scope: boolean;
  asked_impact: boolean;
  asked_deadline_or_urgency: boolean;
  asked_error_message: boolean;
  asked_recent_changes: boolean;
  set_next_steps: boolean;
  used_clear_language: boolean;
  showed_empathy: boolean;
  invented_fix: boolean;
  unsafe_advice: boolean;
}

interface AnalysisOutput {
  overall_score: number;
  readiness_label: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  checkpoints: AnalysisCheckpoints;
  evidence_quotes: string[];
  ticket_score: number;
  ticket_feedback: string;
}

function computeReadiness(score: number, checkpoints: AnalysisCheckpoints): string {
  const scoring = { ready_min: 80, needs_supervision_min: 60 };
  if (checkpoints.unsafe_advice) return 'not_ready';
  if (checkpoints.invented_fix) return 'needs_supervision';
  if (score >= scoring.ready_min) return 'ready';
  if (score >= scoring.needs_supervision_min) return 'needs_supervision';
  return 'not_ready';
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initTables();

    const full = getFullAssessment(params.id);
    if (!full) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const criteria = getActiveCriteria();
    if (!criteria) {
      return NextResponse.json({ error: 'No active criteria version found' }, { status: 500 });
    }

    const scenario = getActiveScenario();

    // Build transcript text
    const transcriptText = full.messages.map(m =>
      `${m.role.toUpperCase()}: ${m.content}`
    ).join('\n\n');

    const ticketText = full.ticket?.candidate_ticket_text || 'No ticket submitted';

    const criteriaParsed = JSON.parse(criteria.criteria_json);
    const checkpointDescriptions = criteriaParsed.checkpoints.map((c: any) =>
      `- ${c.key}: ${c.label}${c.critical ? ' (CRITICAL)' : ''}`
    ).join('\n');

    const systemPrompt = `You are an MSP call readiness evaluator. Assess the candidate's performance in a simulated first-line support call.

SCENARIO: ${scenario?.title || 'Unknown scenario'}
SCENARIO CONTEXT: ${scenario?.caller_persona || ''}

CRITERIA CHECKPOINTS:
${checkpointDescriptions}

CRITICAL FAILURES:
${criteriaParsed.critical_failures.map((f: string) => `- ${f}`).join('\n')}

SCORING:
- 80+ = ready for client calls
- 60-79 = needs supervision
- Below 60 = not ready
- Unsafe advice → not ready (regardless of score)
- Invented fix → capped at needs supervision

Return ONLY valid JSON with this exact structure:
{
  "overall_score": <number 0-100>,
  "readiness_label": "ready|needs_supervision|not_ready",
  "summary": "<2-3 sentence summary>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "checkpoints": {
    "confirmed_user": false,
    "confirmed_company": false,
    "captured_device_or_hostname": false,
    "clarified_issue": false,
    "asked_scope": false,
    "asked_impact": false,
    "asked_deadline_or_urgency": false,
    "asked_error_message": false,
    "asked_recent_changes": false,
    "set_next_steps": false,
    "used_clear_language": false,
    "showed_empathy": false,
    "invented_fix": false,
    "unsafe_advice": false
  },
  "evidence_quotes": ["<quote from transcript>", ...],
  "ticket_score": <number 0-100>,
  "ticket_feedback": "<feedback on ticket>"
}

Be honest and specific. Quote the candidate's actual words.`;

    const userMessage = `TRANSCRIPT:
${transcriptText}

TICKET:
${ticketText}`;

    const result = await runAiTask('evaluator', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      responseFormat: 'json_object',
      temperature: 0.3,
      maxTokens: 2048,
    });

    const db = getDb();

    if (!result.success) {
      console.warn('[MVP] Analysis AI failed:', result.error);
      const resultId = makeId();
      db.prepare(`INSERT INTO assessment_results (id, assessment_id, session_id, criteria_version_id, readiness_label, created_at)
        VALUES (?, ?, ?, ?, 'analysis_failed', datetime('now'))`).run(
        resultId, full.assessment.id, full.session?.id || '', criteria.id
      );
      db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('completed', full.assessment.id);

      return NextResponse.json({
        status: 'analysis_failed',
        error: result.error,
      });
    }

    const parsed = parseJsonResponse<AnalysisOutput>(result.content);
    if (!parsed.data) {
      const resultId = makeId();
      db.prepare(`INSERT INTO assessment_results (id, assessment_id, session_id, criteria_version_id, readiness_label, created_at)
        VALUES (?, ?, ?, ?, 'analysis_failed', datetime('now'))`).run(
        resultId, full.assessment.id, full.session?.id || '', criteria.id
      );
      db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('completed', full.assessment.id);

      return NextResponse.json({
        status: 'analysis_failed',
        error: 'Invalid JSON from model',
        raw: result.content,
      });
    }

    const data = parsed.data;
    const readiness = computeReadiness(data.overall_score, data.checkpoints);

    const resultId = makeId();
    db.prepare(`INSERT INTO assessment_results
      (id, assessment_id, session_id, criteria_version_id, raw_model_json, overall_score, readiness_label, summary, strengths_json, weaknesses_json, checkpoint_json, ticket_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      resultId, full.assessment.id, full.session?.id || '', criteria.id,
      JSON.stringify(data), data.overall_score, readiness,
      data.summary,
      JSON.stringify(data.strengths || []),
      JSON.stringify(data.weaknesses || []),
      JSON.stringify(data.checkpoints || {}),
      data.ticket_score ?? null
    );

    db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('analysed', full.assessment.id);

    return NextResponse.json({
      status: 'analysed',
      result_id: resultId,
      overall_score: data.overall_score,
      readiness_label: readiness,
      summary: data.summary,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      checkpoints: data.checkpoints,
      evidence_quotes: data.evidence_quotes,
      ticket_score: data.ticket_score,
      ticket_feedback: data.ticket_feedback,
    });
  } catch (err) {
    console.error('[MVP] Analyse error:', err);
    return NextResponse.json({ error: 'Failed to analyse assessment', details: String(err) }, { status: 500 });
  }
}
