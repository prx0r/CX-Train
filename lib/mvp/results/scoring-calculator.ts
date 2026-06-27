/**
 * Honest Scoring Calculator
 *
 * Raw score: what the criteria say.
 * Validated score: raw minus penalties from flagged criteria.
 * The gap tells you how confident you should be in the result.
 *
 * Validation checks are honest but conservative:
 * 1. Missing evidence — a "pass" without a real quote gets flagged (not excluded)
 * 2. Heavy fail no evidence — high-weight fail with no explanation gets flagged
 * 3. Relevancy is NOT guessed from keyword matching — it uses pack-relevance mapping
 */

export interface CriterionResult {
  id: string;
  label: string;
  status: 'pass' | 'partial' | 'fail' | 'not_observed' | 'not_applicable';
  weight: number;
  evidence: string[];
  frameworkId: string;
  frameworkName: string;
}

export interface ValidationFinding {
  type: 'no_evidence' | 'heavy_fail_no_evidence';
  criterionId: string;
  label: string;
  frameworkName: string;
  reason: string;
  pointsAtRisk: number;
}

export interface ScoredAssessment {
  rawScore: number;
  validatedScore: number;
  totalCriteria: number;
  applicableCriteria: number;
  findings: ValidationFinding[];
  pointsAtRisk: number;
  warnings: string[];
  verdict: 'PASS' | 'FAIL';
}

const EVIDENCE_KEYWORDS = ['[fixture', 'Event ', 'Content ', 'Found ', 'Keyword ', 'Not ', 'Action ', 'Not applicable'];

function hasRealEvidence(evidence: string[]): boolean {
  if (!evidence || evidence.length === 0) return false;
  return !evidence.some(e => EVIDENCE_KEYWORDS.some(kw => e.startsWith(kw)));
}

export function computeScoredAssessment(criteria: CriterionResult[]): ScoredAssessment {
  const findings: ValidationFinding[] = [];
  const warnings: string[] = [];

  let rawEarned = 0;
  let rawMax = 0;
  let applicableCount = 0;
  let totalPointsAtRisk = 0;

  for (const c of criteria) {
    if (c.status === 'not_applicable') continue;
    applicableCount++;

    const multiplier = c.status === 'pass' ? 1 : c.status === 'partial' ? 0.5 : 0;
    const earned = c.weight * multiplier;
    rawEarned += earned;
    rawMax += c.weight;

    // Check: pass without real evidence
    if (c.status === 'pass' && !hasRealEvidence(c.evidence)) {
      findings.push({
        type: 'no_evidence',
        criterionId: c.id,
        label: c.label,
        frameworkName: c.frameworkName,
        reason: `Marked as pass but no real evidence quote.`,
        pointsAtRisk: c.weight,
      });
      totalPointsAtRisk += c.weight;
    }

    // Check: heavy fail (>=8pts) with no evidence
    if (c.status === 'fail' && c.weight >= 8 && !hasRealEvidence(c.evidence)) {
      findings.push({
        type: 'heavy_fail_no_evidence',
        criterionId: c.id,
        label: c.label,
        frameworkName: c.frameworkName,
        reason: `${c.weight}pt criterion failed but no evidence was provided.`,
        pointsAtRisk: c.weight,
      });
      totalPointsAtRisk += c.weight;
    }
  }

  const rawScore = rawMax > 0 ? Math.round((rawEarned / rawMax) * 100) : 0;

  // Validated score: penalize flagged criteria by removing their contribution
  const flaggedEarned = findings.reduce((s, f) => {
    const c = criteria.find(cr => cr.id === f.criterionId);
    if (!c) return s;
    const multiplier = c.status === 'pass' ? 1 : c.status === 'partial' ? 0.5 : 0;
    return s + (c.weight * multiplier);
  }, 0);
  const validatedEarned = rawEarned - flaggedEarned;
  const validatedScore = rawMax > 0 ? Math.round((validatedEarned / rawMax) * 100) : 0;

  if (findings.length > 0) {
    warnings.push(`${findings.length} criteria flagged (${totalPointsAtRisk}pts at risk). Validated score: ${validatedScore}`);
  }

  const verdict = validatedScore >= 60 ? 'PASS' : 'FAIL';

  return {
    rawScore,
    validatedScore: Math.max(0, validatedScore),
    totalCriteria: criteria.length,
    applicableCriteria: applicableCount,
    findings,
    pointsAtRisk: totalPointsAtRisk,
    warnings,
    verdict,
  };
}

export function buildCriteriaFromFrameworks(
  frameworkResults: Array<{ frameworkId: string; frameworkName: string; criteriaResults: Array<{ criterionId: string; label: string; status: string; evidence: string; pointsEarned: number; pointsMax: number }> }>,
): CriterionResult[] {
  const results: CriterionResult[] = [];
  for (const fw of frameworkResults) {
    for (const c of (fw.criteriaResults || [])) {
      results.push({
        id: c.criterionId,
        label: c.label,
        status: c.status as any,
        weight: c.pointsMax || 1,
        evidence: c.evidence ? [c.evidence] : [],
        frameworkId: fw.frameworkId,
        frameworkName: fw.frameworkName,
      });
    }
  }
  return results;
}
