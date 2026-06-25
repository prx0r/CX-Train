import { getDb } from '@/lib/mvp/db';
import { getActiveCriteria, getActiveScenario, makeId } from '@/lib/mvp/query';
import { buildAssessmentContext } from './context';
import { buildAnalysisInputHash } from './hash';
import { PROMPT_VERSION, RUBRIC_VERSION, PROMPT_SUFFIX, getDefaultModel } from './prompts';
import { runAiTask, parseJsonResponse } from '@/lib/ai/provider';

export async function runBaseCallumAnalysis(assessmentId: string): Promise<{
  status: string;
  result_id?: string;
  analysis_run_id?: string;
  overall_score?: number;
  readiness_label?: string;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  checkpoints?: Record<string, boolean>;
  evidence_quotes?: string[];
  ticket_score?: number;
  ticket_feedback?: string;
  error?: string;
  raw?: string;
  cached?: boolean;
}> {
  const db = getDb();
  const context = buildAssessmentContext(assessmentId);
  if (!context) {
    return { status: 'analysis_failed', error: 'Assessment not found' };
  }

  const criteria = getActiveCriteria();
  if (!criteria) {
    return { status: 'analysis_failed', error: 'No active criteria version found' };
  }

  const scenario = getActiveScenario();
  const model = getDefaultModel();
  const ticketText = context.submitted_ticket || 'No ticket submitted';

  const inputHash = buildAnalysisInputHash({
    transcriptText: context.transcript_text,
    ticketText,
    criteriaVersionId: criteria.id,
    scenarioId: scenario?.id || null,
    assessmentPackId: null,
    promptVersion: PROMPT_VERSION,
    rubricVersion: RUBRIC_VERSION,
    model,
  });

  // Check for existing completed run with same hash
  const existingRun = db.prepare(
    'SELECT id, result_id FROM analysis_runs WHERE input_hash = ? AND status = ? AND analysis_type = ? ORDER BY created_at DESC LIMIT 1'
  ).get(inputHash, 'complete', 'base_callum') as { id: string; result_id: string | null } | undefined;

  if (existingRun && existingRun.result_id) {
    const existingResult = db.prepare(
      'SELECT overall_score, readiness_label, summary, strengths_json, weaknesses_json, checkpoint_json, ticket_score, raw_model_json FROM assessment_results WHERE id = ?'
    ).get(existingRun.result_id) as any;

    if (existingResult) {
      const data = JSON.parse(existingResult.raw_model_json || '{}');
      return {
        status: 'analysed',
        result_id: existingRun.result_id,
        analysis_run_id: existingRun.id,
        overall_score: existingResult.overall_score || undefined,
        readiness_label: existingResult.readiness_label,
        summary: existingResult.summary || undefined,
        strengths: existingResult.strengths_json ? JSON.parse(existingResult.strengths_json) : [],
        weaknesses: existingResult.weaknesses_json ? JSON.parse(existingResult.weaknesses_json) : [],
        checkpoints: existingResult.checkpoint_json ? JSON.parse(existingResult.checkpoint_json) : {},
        ticket_score: existingResult.ticket_score || undefined,
        ticket_feedback: data.ticket_feedback,
        cached: true,
      };
    }
  }

  // Create analysis_run record
  const analysisRunId = makeId();
  db.prepare(`INSERT INTO analysis_runs (id, org_id, manager_id, session_id, assessment_id, assessment_pack_id, analysis_type, prompt_version, rubric_version, model_provider, model, temperature, input_hash, status, result_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run(
    analysisRunId, 'org-default', 'manager-default', context.session_id, assessmentId, null,
    'base_callum', PROMPT_VERSION, RUBRIC_VERSION, 'openrouter', model, 0.3, inputHash, 'running', null
  );

  // Build transcript text
  const transcriptText = context.transcript_text;

  const criteriaParsed = criteria ? JSON.parse(criteria.criteria_json) : { checkpoints: [], critical_failures: [] };
  const checkpointDescriptions = (criteriaParsed.checkpoints || []).map((c: any) =>
    `- ${c.key}: ${c.label}${c.critical ? ' (CRITICAL)' : ''}`
  ).join('\n');

  const systemPrompt = `You are an MSP call readiness evaluator. Assess the candidate's performance in a simulated first-line support call.

SCENARIO: ${scenario?.title || 'Unknown scenario'}
SCENARIO CONTEXT: ${scenario?.caller_persona || ''}

CRITERIA CHECKPOINTS:
${checkpointDescriptions}

CRITICAL FAILURES:
${(criteriaParsed.critical_failures || []).map((f: string) => `- ${f}`).join('\n')}

SCORING:
- 80+ = ready for client calls
- 60-79 = needs supervision
- Below 60 = not ready
- Unsafe advice → not ready (regardless of score)
- Invented fix → capped at needs supervision

${PROMPT_SUFFIX}`;

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

  if (!result.success) {
    db.prepare(`UPDATE analysis_runs SET status = ?, updated_at = datetime('now') WHERE id = ?`).run('failed', analysisRunId);
    return { status: 'analysis_failed', error: result.error };
  }

  const parsed = parseJsonResponse<any>(result.content);
  if (!parsed.data) {
    db.prepare(`UPDATE analysis_runs SET status = ?, updated_at = datetime('now') WHERE id = ?`).run('failed', analysisRunId);
    return { status: 'analysis_failed', error: 'Invalid JSON from model', raw: result.content };
  }

  const data = parsed.data;
  const readiness = computeReadiness(data.overall_score, data.checkpoints);

  const resultId = makeId();
  db.prepare(`INSERT INTO assessment_results
    (id, assessment_id, session_id, criteria_version_id, raw_model_json, overall_score, readiness_label, summary, strengths_json, weaknesses_json, checkpoint_json, ticket_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    resultId, assessmentId, context.session_id, criteria.id,
    JSON.stringify(data), data.overall_score, readiness,
    data.summary,
    JSON.stringify(data.strengths || []),
    JSON.stringify(data.weaknesses || []),
    JSON.stringify(data.checkpoints || {}),
    data.ticket_score ?? null
  );

  db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('analysed', assessmentId);
  db.prepare(`UPDATE analysis_runs SET status = ?, result_id = ?, updated_at = datetime('now') WHERE id = ?`).run('complete', resultId, analysisRunId);

  return {
    status: 'analysed',
    result_id: resultId,
    analysis_run_id: analysisRunId,
    overall_score: data.overall_score,
    readiness_label: readiness,
    summary: data.summary,
    strengths: data.strengths,
    weaknesses: data.weaknesses,
    checkpoints: data.checkpoints,
    evidence_quotes: data.evidence_quotes,
    ticket_score: data.ticket_score,
    ticket_feedback: data.ticket_feedback,
    cached: false,
  };
}

function computeReadiness(score: number, checkpoints: Record<string, boolean>): string {
  const scoring = { ready_min: 80, needs_supervision_min: 60 };
  if (checkpoints?.unsafe_advice) return 'not_ready';
  if (checkpoints?.invented_fix) return 'needs_supervision';
  if (score >= scoring.ready_min) return 'ready';
  if (score >= scoring.needs_supervision_min) return 'needs_supervision';
  return 'not_ready';
}
