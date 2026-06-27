import { getDb } from '@/lib/mvp/db';
import { makeId, getManagerStandards } from '@/lib/mvp/query';
import { buildAssessmentContext } from './context';
import { buildAnalysisInputHash, ANALYSIS_SCHEMA_VERSION } from './hash';
import { PROMPT_VERSION, getDefaultModel } from './prompts';
import { EVIDENCE_PROMPT_VERSION, buildEvidenceExtractionPrompt } from './evidencePrompt';
import { NARRATIVE_PROMPT_VERSION, buildNarrativePrompt } from './narrativePrompt';
import { scoreExtraction, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from './scoring';
import { parseExtractionJson, parseNarrativeJson, buildFallbackNarrative, validateEvidenceGrounding, validateNarrativeQuality } from './validation';
import { evaluateAllFrameworks, type EvidencePool } from '@/lib/mvp/compliance/evaluator';
import { DEFAULT_FRAMEWORKS } from '@/lib/mvp/compliance/frameworks';
import { runAiTask, parseJsonResponse } from '@/lib/ai/provider';
import type { EvidenceExtraction, StructuredOutput, DeterministicScore, NarrativeFeedback, RedFlag, FailGateHit } from './types';
import { RUBRIC_VERSION } from './types';

export const MILESTONE_C_VERSION = RUBRIC_VERSION;

export async function runBaseCallumAnalysis(assessmentId: string): Promise<{
  status: string;
  result_id?: string;
  analysis_run_id?: string;
  overall_score?: number;
  raw_score_before_caps?: number;
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
  compliance?: any;
}> {
  const db = getDb();
  const context = buildAssessmentContext(assessmentId);
  if (!context) {
    return { status: 'analysis_failed', error_code: 'ASSESSMENT_NOT_FOUND', error: 'Assessment not found' };
  }

  if (!context.submitted_ticket) {
    return { status: 'analysis_failed', error_code: 'TICKET_NOT_FOUND', error: 'Cannot analyse assessment because no ticket has been submitted.' };
  }

  if ((!context.transcript_text || context.transcript_messages.length < 2) && !context.assessment_pack_id) {
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
    maxTokens: 8192,
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

  const grounding = validateEvidenceGrounding(extraction, {
    transcriptText: context.transcript_text,
    ticketText: context.submitted_ticket,
  });
  const groundedExtraction = grounding.data;

  // Step 2: Deterministic scoring (pure code, no AI) with fail gates
  const redFlags = (groundedExtraction.red_flags || []).map((f: RedFlag) => ({
    type: f.type,
    severity: f.severity || 'medium',
    evidence: f.evidence || '',
  }));

  /* Check fundamentals from DB */
  const submittedTicket = !!(context.submitted_ticket);
  const performedTriage = context.evidence_timeline?.some(e =>
    e.event_type === 'ticket_triage_submitted' || e.event_type === 'triage_summary_set'
  ) ?? false;

  /* Compute exceptional service bonus from call quality criteria */
  const callQualityCriteria = ['customer_tone', 'professional_conduct', 'customer_communication'];
  const passedQuality = callQualityCriteria.filter(c => {
    const s = groundedExtraction.criteria?.[c]?.status?.toLowerCase();
    return s === 'pass' || s === 'partial';
  }).length;
  /* 0 of 3 = 0pts, 1 of 3 = 2pts, 2 of 3 = 5pts, 3 of 3 = 10pts */
  const exceptionalServiceScore = passedQuality === 3 ? 10 : passedQuality === 2 ? 5 : passedQuality === 1 ? 2 : 0;

  const scoringResult = scoreExtraction({
    criteria: groundedExtraction.criteria,
    redFlags,
    weights: DEFAULT_WEIGHTS,
    thresholds: DEFAULT_THRESHOLDS,
    fundamentals: { submitted_ticket: submittedTicket, performed_triage: performedTriage },
    exceptionalServiceScore,
  });

  /* Step 2.5: Multi-framework compliance evaluation */
  const evidencePool: EvidencePool = {
    aiCriteria: (groundedExtraction.criteria || {}) as Record<string, { status: string; evidence?: string[] }>,
    events: (context.evidence_timeline || []).map(e => ({
      event_type: e.event_type,
      action_id: e.action_id ?? undefined,
      taxonomy_tags: e.taxonomy_tags,
      text: e.text ?? null,
    })),
    transcriptText: context.transcript_text || '',
    ticketText: context.submitted_ticket || '',
    triage: {},
    ticketSubmitted: submittedTicket,
    triagePerformed: performedTriage,
    redFlagsTriggered: (groundedExtraction.red_flags || []).map((f: any) => f.type || ''),
  };
  const complianceResult = evaluateAllFrameworks(evidencePool, DEFAULT_FRAMEWORKS, context.assessment_pack_id);

  // Step 3: Narrative feedback via AI
  const narrativePrompts = buildNarrativePrompt(context, {
    score: scoringResult.score,
    rawScoreBeforeCaps: scoringResult.rawScoreBeforeCaps,
    rating: scoringResult.rating,
    earnedScore: scoringResult.earnedScore,
    maxPossibleScore: scoringResult.maxPossibleScore,
    failedRequiredChecks: scoringResult.failedRequiredChecks,
    triggeredDealbreakers: scoringResult.triggeredDealbreakers,
    gateHits: scoringResult.gateHits,
    skillBreakdown: scoringResult.skillBreakdown,
  }, JSON.stringify(groundedExtraction, null, 2));

  const narrativeResult = await runAiTask('evaluator', {
    messages: [
      { role: 'system', content: narrativePrompts.system },
      { role: 'user', content: narrativePrompts.user },
    ],
    responseFormat: 'json_object',
    temperature: 0.3,
    maxTokens: 4096,
  });

  let narrative: any;
  if (!narrativeResult.success) {
    narrative = buildFallbackNarrative(groundedExtraction, scoringResult.score, scoringResult.rating);
  } else {
    const parsed = parseNarrativeJson(narrativeResult.content);
    if (parsed.error || !parsed.data) {
      narrative = buildFallbackNarrative(groundedExtraction, scoringResult.score, scoringResult.rating);
    } else {
      narrative = parsed.data;
    }
  }
  const narrativeValidation = validateNarrativeQuality(narrative, scoringResult.score, scoringResult.rating);
  narrative = narrativeValidation.data;

  // Build structured output
  const structured: StructuredOutput = {
    schema_version: MILESTONE_C_VERSION,
    evidence_validation: {
      grounded: grounding.warnings.length === 0,
      warnings: [...extractionWarnings, ...grounding.warnings],
      details: grounding.details,
    },
    narrative_validation: {
      passed: narrativeValidation.warnings.length === 0,
      warnings: narrativeValidation.warnings,
    },
    evidence_extraction: {
      criteria: groundedExtraction.criteria,
      missed_questions: groundedExtraction.missed_questions || [],
      red_flags: groundedExtraction.red_flags || [],
      ticket_assessment: groundedExtraction.ticket_assessment || { status: 'not_observed', missing_fields: [], evidence: '' },
    },
    deterministic_score: {
      score: scoringResult.score,
      rawScoreBeforeCaps: scoringResult.rawScoreBeforeCaps,
      rating: scoringResult.rating,
      earnedScore: scoringResult.earnedScore,
      maxPossibleScore: scoringResult.maxPossibleScore,
      failedRequiredChecks: scoringResult.failedRequiredChecks,
      triggeredDealbreakers: scoringResult.triggeredDealbreakers,
      gateHits: scoringResult.gateHits,
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
    compliance: complianceResult,
  };

  // Map to old assessment_results columns for backward compat
  const checklistForDb = buildChecklistFromExtraction(groundedExtraction, scoringResult);

  const evidenceQuotes = collectEvidenceQuotes(groundedExtraction);

  const resultId = makeId();
  db.prepare(`INSERT INTO assessment_results
    (id, assessment_id, session_id, criteria_version_id, raw_model_json, overall_score, readiness_label, summary, strengths_json, weaknesses_json, checkpoint_json, ticket_score, compliance_score, compliance_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    resultId, assessmentId, context.session_id, null,
    JSON.stringify(structured), scoringResult.score, scoringResult.rating,
    narrative.summary || `Candidate scored ${scoringResult.score}/100 (${scoringResult.rating}).`,
    JSON.stringify(narrative.strengths || []),
    JSON.stringify(narrative.improvements || []),
    JSON.stringify(checklistForDb),
    null,
    complianceResult.combinedScore,
    JSON.stringify(complianceResult)
  );

  db.prepare('UPDATE assessments SET status = ? WHERE id = ?').run('analysed', assessmentId);
  db.prepare(`UPDATE analysis_runs SET status = ?, result_id = ?, updated_at = datetime('now') WHERE id = ?`).run('complete', resultId, analysisRunId);

  return {
    status: 'analysed',
    result_id: resultId,
    analysis_run_id: analysisRunId,
    overall_score: scoringResult.score,
    raw_score_before_caps: scoringResult.rawScoreBeforeCaps,
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
    compliance: complianceResult,
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

/* ── Category mapping: flat criteria → categories ───── */

const CATEGORY_CRITERIA_MAP: Record<string, string[]> = {
  fundamentals: ['submitted_ticket', 'performed_triage', 'next_steps'],
  call_control: ['identity_check', 'company_check', 'customer_tone', 'professional_conduct', 'customer_communication'],
  diagnosis: ['issue_clarification', 'started_when', 'impact', 'urgency', 'scope', 'technical_discovery', 'error_or_status_capture', 'recent_changes'],
  resolution: ['safety', 'escalation_judgement'],
  ticket_quality: ['ticket_user_company', 'ticket_issue_summary', 'ticket_impact', 'ticket_urgency', 'ticket_checks_attempted', 'ticket_next_step'],
  professionalism: ['unsafe_security_behaviour', 'severe_customer_abuse', 'refusal_to_help', 'hallucinated_fix', 'unsafe_advice', 'invented_fix_without_evidence', 'no_troubleshooting'],
};

const CATEGORY_LABELS: Record<string, string> = {
  fundamentals: 'Fundamentals (Required)',
  call_control: 'Call Control & Communication',
  diagnosis: 'Diagnosis & Investigation',
  resolution: 'Resolution & Fix',
  ticket_quality: 'Ticket Quality',
  professionalism: 'Professionalism & Safety',
};

/* ── Candidate-safe analysis summary ─────────────────── */

export interface CandidateAnalysisResult {
  overall_score: number;
  verdict: 'PASS' | 'FAIL';
  criticalFailure: string | null;
  summary: string;
  verdictLine: string;
  strengths: string[];
  improvements: string[];
  diagnostic_checklist: Record<string, boolean>;
  narrative: {
    summary: string;
    ticket_feedback: string;
    coaching_focus: string[];
  };
  categoryScores?: CategoryScoreResult[];
  whatCostYouMost?: Array<{ label: string; pointsLost: number; category: string }>;
  bonus: number;
  coreEarned: number;
  maxCore: number;
  compliance?: {
    combinedScore: number;
    combinedVerdict: string;
    certifiedFrameworks: string[];
    failedFrameworks: string[];
    frameworks: Array<{
      id: string;
      name: string;
      score: number;
      passed: boolean;
      summary: string;
      criticalFailures: string[];
      criteria: Array<{ id: string; label: string; status: string; evidence: string; earned: number; max: number }>;
    }>;
  };
  error?: string;
}

export interface CategoryScoreResult {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  percent: number;
  criteria: Array<{
    id: string;
    label: string;
    category: string;
    status: string;
    weight: number;
    earned: number;
    max: number;
  }>;
}

const CRITERION_LABELS: Record<string, string> = {
  submitted_ticket: 'Submitted a ticket/closure',
  performed_triage: 'Performed ticket triage',
  identity_check: 'Confirmed caller identity',
  company_check: 'Confirmed company name',
  customer_tone: 'Professional tone with customer',
  professional_conduct: 'Professional conduct throughout',
  customer_communication: 'Clear customer communication',
  issue_clarification: 'Clarified the issue',
  started_when: 'Asked when it started',
  impact: 'Asked about business impact',
  urgency: 'Asked about urgency/deadline',
  scope: 'Asked scope (one or many users)',
  technical_discovery: 'Performed technical discovery',
  error_or_status_capture: 'Captured error messages or status',
  recent_changes: 'Asked about recent changes',
  safety: 'Safety awareness',
  escalation_judgement: 'Appropriate escalation judgement',
  next_steps: 'Set clear next steps',
  ticket_user_company: 'Ticket: user + company',
  ticket_issue_summary: 'Ticket: issue summary',
  ticket_impact: 'Ticket: impact noted',
  ticket_urgency: 'Ticket: urgency noted',
  ticket_checks_attempted: 'Ticket: checks attempted',
  ticket_next_step: 'Ticket: next step set',
  unsafe_security_behaviour: 'Unsafe security behaviour',
  severe_customer_abuse: 'Severe customer abuse',
  refusal_to_help: 'Refusal to help',
  hallucinated_fix: 'Hallucinated a fix',
  unsafe_advice: 'Gave unsafe advice',
  invented_fix_without_evidence: 'Invented fix without evidence',
  no_troubleshooting: 'No troubleshooting performed',
};

export function buildCandidateAnalysis(analysisData: any, pack?: { diagnosticChecklist?: { id: string; label: string; criteria: string }[] } | null): CandidateAnalysisResult | null {
  if (!analysisData || analysisData.status === 'analysis_failed') return null;

  const structured = analysisData.structured as Record<string, any> | undefined;
  const score = structured?.deterministic_score;
  const narrative = structured?.narrative;
  const criteria = structured?.evidence_extraction?.criteria as Record<string, { status: string }> | undefined;
  const compliance = (structured?.compliance || analysisData.compliance) as any;

  const checklist: Record<string, boolean> = {};
  if (criteria) {
    for (const [key, criterion] of Object.entries(criteria)) {
      checklist[key] = criterion.status === 'pass';
    }
  }

  /* Build per-category scores + per-criterion breakdowns */
  const categoryScores: CategoryScoreResult[] = [];
  const whatCostYouMost: Array<{ label: string; pointsLost: number; category: string }> = [];
  const failedChecks = score?.failedRequiredChecks || [];

  for (const [catId, criterionIds] of Object.entries(CATEGORY_CRITERIA_MAP)) {
    const catCriteria: CategoryScoreResult['criteria'] = [];
    let catEarned = 0;
    let catMax = 0;

    for (const cId of criterionIds) {
      /* Fundamentals (submitted_ticket, performed_triage) aren't AI criteria — derive from failedRequiredChecks */
      let status: string;
      if (cId === 'submitted_ticket' || cId === 'performed_triage') {
        status = failedChecks.includes(cId) ? 'fail' : 'pass';
      } else {
        status = criteria?.[cId]?.status || 'not_observed';
      }

      const skillEntry = score?.skillBreakdown?.[cId];
      const weight = skillEntry?.maxScore ?? 1;
      const earned = skillEntry?.score ?? (status === 'pass' ? weight : status === 'partial' ? weight * 0.5 : 0);
      catEarned += earned;
      catMax += weight;

      const result: CategoryScoreResult['criteria'][0] = {
        id: cId,
        label: CRITERION_LABELS[cId] || cId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category: catId,
        status,
        weight,
        earned,
        max: weight,
      };
      catCriteria.push(result);

      /* Track what cost the most points */
      if (status !== 'pass') {
        const lost = weight - earned;
        if (lost > 0) {
          whatCostYouMost.push({
            label: result.label,
            pointsLost: lost,
            category: catId,
          });
        }
      }
    }

    const pct = catMax > 0 ? Math.round((catEarned / catMax) * 100) : 0;
    categoryScores.push({
      id: catId,
      label: CATEGORY_LABELS[catId] || catId,
      score: catEarned,
      maxScore: catMax,
      percent: pct,
      criteria: catCriteria,
    });
  }

  whatCostYouMost.sort((a, b) => b.pointsLost - a.pointsLost);
  const verdict = score?.verdict || 'FAIL';
  const criticalFailure = score?.criticalFailure || null;
  const bonus = score?.bonus || 0;
  const coreEarned = score?.coreEarned || 0;
  const maxCore = score?.maxPossibleScore || Object.keys(CATEGORY_CRITERIA_MAP).reduce((sum, k) => sum + CATEGORY_CRITERIA_MAP[k].length, 0);

  /* Build one-line verdict */
  let verdictLine: string;
  if (verdict === 'PASS') {
    const topStrengths = (analysisData.strengths || narrative?.strengths || []).slice(0, 2);
    verdictLine = `PASS ${analysisData.overall_score ?? score?.score ?? 0}/100 — ${topStrengths.join('. ') || 'All critical criteria met.'}`;
  } else {
    verdictLine = `FAIL ${analysisData.overall_score ?? score?.score ?? 0}/100 — ${criticalFailure || 'Score below minimum threshold.'}`;
  }

  return {
    overall_score: analysisData.overall_score ?? score?.score ?? 0,
    verdict,
    criticalFailure,
    summary: analysisData.summary ?? score?.summary ?? 'Analysis complete.',
    verdictLine,
    strengths: analysisData.strengths ?? narrative?.strengths ?? [],
    improvements: analysisData.weaknesses ?? narrative?.improvements ?? [],
    diagnostic_checklist: checklist,
    narrative: {
      summary: narrative?.summary ?? analysisData.summary ?? '',
      ticket_feedback: narrative?.ticket_feedback ?? analysisData.ticket_feedback ?? '',
      coaching_focus: narrative?.coaching_focus ?? [],
    },
    categoryScores,
    whatCostYouMost: whatCostYouMost.slice(0, 5),
    bonus,
    coreEarned,
    maxCore,
    compliance: compliance ? {
      combinedScore: compliance.combinedScore,
      combinedVerdict: compliance.combinedVerdict,
      certifiedFrameworks: compliance.certifiedFrameworks || [],
      failedFrameworks: compliance.failedFrameworks || [],
      frameworks: (compliance.frameworks || []).map((fw: any) => ({
        id: fw.frameworkId,
        name: fw.frameworkName,
        score: fw.score,
        passed: fw.passed,
        summary: fw.summary,
        criticalFailures: fw.criticalFailures || [],
        criteria: (fw.criteriaResults || []).map((cr: any) => ({
          id: cr.criterionId, label: cr.label, status: cr.status,
          evidence: cr.evidence, earned: cr.pointsEarned, max: cr.pointsMax,
        })),
      })),
    } : undefined,
  };
}
