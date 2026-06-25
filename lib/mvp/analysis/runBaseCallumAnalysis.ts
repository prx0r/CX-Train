import { getDb } from '@/lib/mvp/db';
import { makeId, getManagerStandards } from '@/lib/mvp/query';
import { buildAssessmentContext } from './context';
import { buildAnalysisInputHash, ANALYSIS_SCHEMA_VERSION } from './hash';
import { PROMPT_VERSION, RUBRIC_VERSION, getDefaultModel } from './prompts';
import { EVIDENCE_PROMPT_VERSION, buildEvidenceExtractionPrompt } from './evidencePrompt';
import { NARRATIVE_PROMPT_VERSION, buildNarrativePrompt } from './narrativePrompt';
import { scoreExtraction, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, DEFAULT_DEALBREAKERS } from './scoring';
import { parseExtractionJson, parseNarrativeJson, buildFallbackNarrative } from './validation';
import { runAiTask, parseJsonResponse } from '@/lib/ai/provider';
import type { EvidenceExtraction, StructuredOutput, DeterministicScore, NarrativeFeedback, RedFlag } from './types';

export const MILESTONE_C_VERSION = 'base-callum-deterministic-v1';

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
  error_code?: string;
  raw?: string;
  cached?: boolean;
  structured?: StructuredOutput;
}> {
  const db = getDb();
  const context = buildAssessmentContext(assessmentId);
  if (!context) {
    return { status: 'analysis_failed', error_code: 'ASSESSMENT_NOT_FOUND', error: 'Assessment not found' };
  }

  if (!context.submitted_ticket) {
    return { status: 'analysis_failed', error_code: 'TICKET_NOT_FOUND', error: 'Cannot analyse assessment because no ticket has been submitted.' };
  }

  if (!context.transcript_text || context.transcript_messages.length < 2) {
    return { status: 'analysis_failed', error_code: 'NO_MESSAGES_FOUND', error: 'Cannot analyse assessment because there are no messages.' };
  }

  const model = getDefaultModel();
  const ticketText = context.submitted_ticket || '';
  const standards = getManagerStandards();
  const standardsContent = standards
    ? JSON.stringify({ id: standards.id, updated_at: standards.updated_at, required_ticket_fields: standards.required_ticket_fields_json, call_requirements: standards.call_requirements })
    : '';

  const inputHash = buildAnalysisInputHash({
    transcriptText: context.transcript_text,
    ticketText,
    criteriaVersionId: null,
    scenarioId: context.active_scenario ? (context.active_scenario as any).id || null : null,
    assessmentPackId: context.assessment_pack_id,
    promptVersion: EVIDENCE_PROMPT_VERSION,
    rubricVersion: RUBRIC_VERSION,
    model,
    managerStandardsContent: standardsContent,
    schemaVersion: MILESTONE_C_VERSION,
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
      const data = parseJsonResponse<StructuredOutput>(existingResult.raw_model_json || '{}');
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
        ticket_feedback: data.data?.narrative?.ticket_feedback,
        cached: true,
        structured: data.data || undefined,
      };
    }
  }

  // Create analysis_run record
  const analysisRunId = makeId();
  db.prepare(`INSERT INTO analysis_runs (id, org_id, manager_id, session_id, assessment_id, assessment_pack_id, analysis_type, prompt_version, rubric_version, model_provider, model, temperature, input_hash, status, result_id, error_code, error_message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run(
    analysisRunId, 'org-default', 'manager-default', context.session_id, assessmentId, null,
    'base_callum', MILESTONE_C_VERSION, RUBRIC_VERSION, 'openrouter', model, 0, inputHash, 'running', null, null, null
  );

  // Step 1: Evidence extraction via AI (temperature 0)
  const evidencePrompts = buildEvidenceExtractionPrompt(context);

  const extractionResult = await runAiTask('evaluator', {
    messages: [
      { role: 'system', content: evidencePrompts.system },
      { role: 'user', content: evidencePrompts.user },
    ],
    responseFormat: 'json_object',
    temperature: 0,
    maxTokens: 2048,
  });

  if (!extractionResult.success) {
    const errCode = extractionResult.error?.includes('API key') ? 'AI_PROVIDER_MISSING_KEY' : 'AI_PROVIDER_FAILED';
    db.prepare(`UPDATE analysis_runs SET status = ?, error_code = ?, error_message = ?, updated_at = datetime('now') WHERE id = ?`).run('failed', errCode, extractionResult.error || 'Evidence extraction failed', analysisRunId);
    return { status: 'analysis_failed', error_code: errCode, error: `Evidence extraction failed: ${extractionResult.error}` };
  }

  const { data: extraction, error: extractionParseError, warnings: extractionWarnings } = parseExtractionJson(extractionResult.content);
  if (extractionParseError || !extraction) {
    db.prepare(`UPDATE analysis_runs SET status = ?, error_code = ?, error_message = ?, updated_at = datetime('now') WHERE id = ?`).run('failed', 'AI_INVALID_JSON', extractionParseError || 'Invalid extraction JSON', analysisRunId);
    return { status: 'analysis_failed', error_code: 'AI_INVALID_JSON', error: extractionParseError || 'Invalid extraction JSON', raw: extractionResult.content };
  }

  // Step 2: Deterministic scoring (pure code, no AI)
  const redFlags = (extraction.red_flags || []).map((f: RedFlag) => ({ type: f.type, severity: f.severity || 'medium' }));

  const scoringResult = scoreExtraction({
    criteria: extraction.criteria,
    redFlags,
    weights: DEFAULT_WEIGHTS,
    thresholds: DEFAULT_THRESHOLDS,
    dealbreakers: DEFAULT_DEALBREAKERS,
  });

  // Step 3: Narrative feedback via AI
  const narrativePrompts = buildNarrativePrompt(context, {
    score: scoringResult.score,
    rating: scoringResult.rating,
    earnedScore: scoringResult.earnedScore,
    maxPossibleScore: scoringResult.maxPossibleScore,
    failedRequiredChecks: scoringResult.failedRequiredChecks,
    triggeredDealbreakers: scoringResult.triggeredDealbreakers,
    skillBreakdown: scoringResult.skillBreakdown,
  }, JSON.stringify(extraction, null, 2));

  const narrativeResult = await runAiTask('evaluator', {
    messages: [
      { role: 'system', content: narrativePrompts.system },
      { role: 'user', content: narrativePrompts.user },
    ],
    responseFormat: 'json_object',
    temperature: 0.3,
    maxTokens: 2048,
  });

  let narrative: any;
  if (!narrativeResult.success) {
    narrative = buildFallbackNarrative(extraction, scoringResult.score, scoringResult.rating);
  } else {
    const parsed = parseNarrativeJson(narrativeResult.content);
    if (parsed.error || !parsed.data) {
      narrative = buildFallbackNarrative(extraction, scoringResult.score, scoringResult.rating);
    } else {
      narrative = parsed.data;
    }
  }

  // Build structured output
  const structured: StructuredOutput = {
    schema_version: MILESTONE_C_VERSION,
    evidence_extraction: {
      criteria: extraction.criteria,
      missed_questions: extraction.missed_questions || [],
      red_flags: extraction.red_flags || [],
      ticket_assessment: extraction.ticket_assessment || { status: 'not_observed', missing_fields: [], evidence: '' },
    },
    deterministic_score: {
      score: scoringResult.score,
      rating: scoringResult.rating,
      earnedScore: scoringResult.earnedScore,
      maxPossibleScore: scoringResult.maxPossibleScore,
      failedRequiredChecks: scoringResult.failedRequiredChecks,
      triggeredDealbreakers: scoringResult.triggeredDealbreakers,
      skillBreakdown: scoringResult.skillBreakdown,
    },
    narrative: {
      summary: narrative.summary || '',
      strengths: narrative.strengths || [],
      improvements: narrative.improvements || [],
      most_costly_miss: narrative.most_costly_miss || '',
      ticket_feedback: narrative.ticket_feedback || '',
      better_phrasing_examples: narrative.better_phrasing_examples || [],
      manager_standard_fit: narrative.manager_standard_fit || { status: 'partial', notes: [] },
      coaching_focus: narrative.coaching_focus || [],
    },
  };

  // Map to old assessment_results columns for backward compat
  const checklistForDb = buildChecklistFromExtraction(extraction, scoringResult);

  const evidenceQuotes = collectEvidenceQuotes(extraction);

  const resultId = makeId();
  db.prepare(`INSERT INTO assessment_results
    (id, assessment_id, session_id, criteria_version_id, raw_model_json, overall_score, readiness_label, summary, strengths_json, weaknesses_json, checkpoint_json, ticket_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    resultId, assessmentId, context.session_id, null,
    JSON.stringify(structured), scoringResult.score, scoringResult.rating,
    narrative.summary || `Candidate scored ${scoringResult.score}/100 (${scoringResult.rating}).`,
    JSON.stringify(narrative.strengths || []),
    JSON.stringify(narrative.improvements || []),
    JSON.stringify(checklistForDb),
    null
  );

  db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('analysed', assessmentId);
  db.prepare(`UPDATE analysis_runs SET status = ?, result_id = ?, updated_at = datetime('now') WHERE id = ?`).run('complete', resultId, analysisRunId);

  return {
    status: 'analysed',
    result_id: resultId,
    analysis_run_id: analysisRunId,
    overall_score: scoringResult.score,
    readiness_label: scoringResult.rating,
    summary: narrative.summary || `Candidate scored ${scoringResult.score}/100 (${scoringResult.rating}).`,
    strengths: narrative.strengths || [],
    weaknesses: narrative.improvements || [],
    checkpoints: checklistForDb,
    evidence_quotes: evidenceQuotes,
    ticket_score: undefined,
    ticket_feedback: narrative.ticket_feedback || '',
    cached: false,
    structured,
  };
}

function buildChecklistFromExtraction(extraction: any, scoringResult: any): Record<string, boolean> {
  const checklist: Record<string, boolean> = {};
  if (extraction?.criteria) {
    for (const [key, criterion] of Object.entries(extraction.criteria as Record<string, any>)) {
      checklist[key] = criterion.status === 'pass';
    }
  }
  return checklist;
}

function collectEvidenceQuotes(extraction: any): string[] {
  const quotes: string[] = [];
  if (extraction?.criteria) {
    for (const criterion of Object.values(extraction.criteria as Record<string, any>) as any[]) {
      if (criterion.evidence && Array.isArray(criterion.evidence)) {
        for (const e of criterion.evidence) {
          if (e && !quotes.includes(e)) {
            quotes.push(e);
          }
        }
      }
    }
  }
  return quotes;
}
