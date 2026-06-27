/**
 * Multi-framework compliance evaluator.
 * Each framework reads the same EvidencePool and produces a FrameworkResult.
 * CombinedComplianceResult aggregates all frameworks into one score.
 */

import { getRelevantCriteria } from './pack-relevance';

export interface FrameworkCriterion {
  id: string;
  label: string;
  weight: number;
  category: string;
  subcategory?: string;
  critical: boolean;
  checkType: 'ai_criteria'
    | 'event_check'
    | 'ticket_field'
    | 'triage_check'
    | 'transcript_keyword'
    | 'action_performed'
    | 'action_not_performed';
  checkTarget: string;
  passIf: 'pass' | 'pass_or_partial' | 'not_fail';
  evidenceDescription: string;
  /** Whether this criterion can be observed during an individual support call.
   *  If false, it's an organizational-level control not directly assessable
   *  from a single call transcript. These are stored for completeness of
   *  the standard but skipped in per-call scoring. */
  observableInCall?: boolean;
}

export interface FrameworkDefinition {
  id: string;
  name: string;
  version: string;
  type: 'baseline' | 'manager_overlay' | 'compliance_standard' | 'skills_framework';
  category: string;
  criteria: FrameworkCriterion[];
  passThreshold: number;
  weight: number;
  description: string;
  standardsAlignments?: string[];
}

export interface CriterionResult {
  criterionId: string;
  label: string;
  subcategory?: string;
  status: 'pass' | 'fail' | 'not_assessable' | 'not_applicable';
  evidence: string;
  pointsEarned: number;
  pointsMax: number;
}

export interface FrameworkResult {
  frameworkId: string;
  frameworkName: string;
  score: number;
  passed: boolean;
  criticalFailures: string[];
  criteriaResults: CriterionResult[];
  summary: string;
}

export interface EvidencePool {
  aiCriteria: Record<string, { status: string; evidence?: string[] }>;
  events: Array<{
    event_type: string;
    action_id?: string;
    taxonomy_tags?: string[];
    text?: string | null;
  }>;
  transcriptText: string;
  ticketText: string;
  triage: Record<string, string>;
  ticketSubmitted: boolean;
  triagePerformed: boolean;
  redFlagsTriggered: string[];
}

export interface CombinedComplianceResult {
  frameworks: FrameworkResult[];
  combinedScore: number;
  combinedVerdict: 'PASS' | 'FAIL';
  certifiedFrameworks: string[];
  failedFrameworks: string[];
  summary: string;
}

function applyPassIf(baseStatus: string, passIf: FrameworkCriterion['passIf']): 'pass' | 'fail' {
  switch (passIf) {
    case 'pass': return baseStatus === 'pass' ? 'pass' : 'fail';
    case 'pass_or_partial': return (baseStatus === 'pass' || baseStatus === 'partial') ? 'pass' : 'fail';
    case 'not_fail': return baseStatus !== 'fail' ? 'pass' : 'fail';
    default: return baseStatus === 'pass' ? 'pass' : 'fail';
  }
}

export function evaluateSingleFramework(
  evidence: EvidencePool,
  fw: FrameworkDefinition,
  packId?: string | null,
): FrameworkResult {
  const relevantCriteria = getRelevantCriteria(packId || null, fw.id);

  let earnedTotal = 0;
  let maxTotal = 0;
  const criticalFailures: string[] = [];
  const criteriaResults: CriterionResult[] = [];

  for (const criterion of fw.criteria) {
    /* Skip criteria that are not observable from a single call */
    if (criterion.observableInCall === false) {
      criteriaResults.push({
        criterionId: criterion.id,
        label: criterion.label,
        status: 'not_applicable',
        evidence: 'Organisational-level control — not assessable from individual call',
        pointsEarned: 0,
        pointsMax: 0,
      });
      continue;
    }

    /* Check if this criterion is relevant to the current pack */
    if (relevantCriteria && !relevantCriteria.includes(criterion.id)) {
      criteriaResults.push({
        criterionId: criterion.id,
        label: criterion.label,
        status: 'not_applicable',
        evidence: 'Not applicable for this ticket type',
        pointsEarned: 0,
        pointsMax: 0,
      });
      continue;
    }

    let baseStatus: 'pass' | 'partial' | 'fail' | 'not_assessable' = 'not_assessable';
    let evidenceStr = '';

    switch (criterion.checkType) {
      case 'ai_criteria': {
        const aiResult = evidence.aiCriteria[criterion.checkTarget];
        if (!aiResult) { baseStatus = 'not_assessable'; break; }
        const s = aiResult.status.toLowerCase();
        baseStatus = (s === 'pass' || s === 'partial' || s === 'fail') ? s : (s === 'not_observed' ? 'partial' : 'not_assessable');
        evidenceStr = (aiResult.evidence && aiResult.evidence.length > 0)
          ? aiResult.evidence.join('; ') : s;
        break;
      }
      case 'event_check': {
        const found = evidence.events.some(e =>
          e.event_type === criterion.checkTarget ||
          (e.taxonomy_tags && e.taxonomy_tags.includes(criterion.checkTarget))
        );
        baseStatus = found ? 'pass' : 'fail';
        evidenceStr = found ? `Event "${criterion.checkTarget}" found` : 'Event not found';
        break;
      }
      case 'ticket_field': {
        const pattern = criterion.checkTarget.replace(/_/g, ' ').toLowerCase();
        const found = evidence.ticketText.toLowerCase().includes(pattern)
          || evidence.ticketText.toLowerCase().includes(criterion.checkTarget.toLowerCase());
        baseStatus = found ? 'pass' : 'fail';
        evidenceStr = found ? 'Content found in submitted ticket' : 'Not found in submitted ticket';
        break;
      }
      case 'transcript_keyword': {
        const patterns = criterion.checkTarget.split('|').map(p => p.trim().toLowerCase());
        const found = patterns.some(p => evidence.transcriptText.toLowerCase().includes(p));
        baseStatus = found ? 'pass' : 'fail';
        evidenceStr = found ? 'Keyword found in transcript' : 'Keyword not found in transcript';
        break;
      }
      case 'action_performed': {
        const found = evidence.events.some(e => e.action_id === criterion.checkTarget);
        baseStatus = found ? 'pass' : 'fail';
        evidenceStr = found ? `Action "${criterion.checkTarget}" performed` : 'Action not performed';
        break;
      }
      case 'action_not_performed': {
        const found = evidence.events.some(e => e.action_id === criterion.checkTarget);
        baseStatus = found ? 'fail' : 'pass';
        evidenceStr = found ? `PROHIBITED action "${criterion.checkTarget}" performed` : 'Action correctly avoided';
        break;
      }
      case 'triage_check': {
        const found = Object.values(evidence.triage).some(v =>
          String(v).toLowerCase().includes(criterion.checkTarget.toLowerCase())
        );
        baseStatus = found ? 'pass' : 'fail';
        evidenceStr = found ? 'Found in triage classification' : 'Not found in triage classification';
        break;
      }
      default: {
        baseStatus = 'not_assessable';
        evidenceStr = 'Unknown check type';
      }
    }

    /* Apply passIf universally — not just for ai_criteria */
    const status = baseStatus === 'not_assessable' ? 'not_assessable' : applyPassIf(baseStatus, criterion.passIf);

    const earned = status === 'pass' ? criterion.weight : 0;
    if (status !== 'not_assessable') {
      earnedTotal += earned;
      maxTotal += criterion.weight;
    }

    if (criterion.critical && status === 'fail') {
      criticalFailures.push(criterion.id);
    }

    criteriaResults.push({
      criterionId: criterion.id,
      label: criterion.label,
      subcategory: criterion.subcategory,
      status,
      evidence: evidenceStr,
      pointsEarned: earned,
      pointsMax: criterion.weight,
    });
  }

  const score = maxTotal > 0 ? Math.round((earnedTotal / maxTotal) * 100) : 0;
  const passed = score >= fw.passThreshold && criticalFailures.length === 0;

  return {
    frameworkId: fw.id,
    frameworkName: fw.name,
    score,
    passed,
    criticalFailures,
    criteriaResults,
    summary: passed
      ? `PASS ${score}/100 — All critical criteria met`
      : `FAIL ${score}/100 — Critical failures: ${criticalFailures.join(', ')}`,
  };
}

export function evaluateAllFrameworks(
  evidence: EvidencePool,
  frameworks: FrameworkDefinition[],
  packId?: string | null,
): CombinedComplianceResult {
  const results: FrameworkResult[] = frameworks.map(fw => evaluateSingleFramework(evidence, fw, packId));

  /* Find the primary framework (Callum Baseline = manager framework = the real score) */
  const primary = results.find(r => r.frameworkId === 'callum_baseline_v1');

  const certifiedFrameworks = results.filter(r => r.passed).map(r => r.frameworkName);
  const failedFrameworks = results.filter(r => !r.passed).map(r => r.frameworkName);

  return {
    frameworks: results,
    /* The combined score is just the primary framework score — not a weighted aggregate */
    combinedScore: primary?.score ?? 0,
    combinedVerdict: primary?.passed ? 'PASS' : 'FAIL',
    certifiedFrameworks,
    failedFrameworks,
    summary: `${primary ? (primary.passed ? 'PASS' : 'FAIL') : 'N/A'} ${primary?.score ?? 0}/100 — Callum Baseline (${primary?.passed ? 'passed' : 'failed'})`,
  };
}
