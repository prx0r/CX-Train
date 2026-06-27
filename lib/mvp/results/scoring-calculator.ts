/**
 * Transparent Weighted Scoring Calculator
 *
 * Takes raw criteria results and computes framework → category → total scores
 * with full transparency on how each criterion contributes.
 */

export interface CriterionContribution {
  id: string;
  label: string;
  weight: number;
  status: 'pass' | 'partial' | 'fail' | 'not_observed' | 'not_applicable';
  multiplier: number;      // pass=1, partial=0.5, fail=0, not_observed=0, not_applicable=excluded
  earned: number;          // weight × multiplier
  maxPossible: number;     // weight (or 0 if not_applicable)
  pctContribution: number; // what % of the framework score this criterion contributed
}

export interface FrameworkScoreBreakdown {
  id: string;
  name: string;
  category: string;
  rawScore: number;        // sum(earned) / sum(max) × 100
  weight: number;          // weight within its category (e.g., 60 for 60%)
  weightedContribution: number; // rawScore × weight / 100
  criteria: CriterionContribution[];
}

export interface CategoryScoreBreakdown {
  id: string;
  label: string;
  rawScore: number;        // weighted average of framework scores
  weight: number;          // weight within total (e.g., 25 for 25%)
  weightedContribution: number; // rawScore × weight / 100
  frameworks: FrameworkScoreBreakdown[];
}

export interface ValidationFlags {
  relevanceRatio: number;           // % of criteria that were applicable
  lowEvidenceCount: number;         // criteria with pass but no evidence quote
  categoryImbalance: number;        // std dev across category scores
  extremeFlags: string[];           // e.g., "score dropped 40pts from raw to final"
  confidence: number;              // 0-100 how confident in this score
  warnings: string[];
}

export interface ScoredAssessment {
  totalScore: number;
  validatedScore: number;   // adjusted for confidence
  totalVerdict: 'PASS' | 'FAIL';
  categories: CategoryScoreBreakdown[];
  validation: ValidationFlags;
}

const STATUS_MULTIPLIER: Record<string, number> = {
  pass: 1,
  partial: 0.5,
  fail: 0,
  not_observed: 0,
  not_applicable: -1,  // excluded from both numerator and denominator
};

interface RawCriterionResult {
  id: string;
  label: string;
  status: string;
  weight: number;
  evidence?: string[];
}

interface RawFrameworkResult {
  id: string;
  name: string;
  category: string;
  score: number;
  criteria: RawCriterionResult[];
}

interface CategoryDef {
  id: string;
  label: string;
  weight: number;
  frameworkWeights: Record<string, number>;  // framework id → weight within category
}

/**
 * Compute a full scored assessment with full transparency.
 */
export function computeScoredAssessment(
  frameworkResults: RawFrameworkResult[],
  categoryDefs: CategoryDef[],
): ScoredAssessment {
  const categories: CategoryScoreBreakdown[] = [];
  const allWarnings: string[] = [];
  let totalRawScore = 0;
  let totalWeight = 0;
  let totalEarnedScore = 0;
  let totalMaxScore = 0;
  let totalValidatedScore = 0;
  let totalValidationWeight = 0;

  for (const catDef of categoryDefs) {
    const matchedFrameworks = frameworkResults.filter(fw => {
      return Object.keys(catDef.frameworkWeights).includes(fw.id);
    });

    const frameworkBreakdowns: FrameworkScoreBreakdown[] = [];
    let catRawScore = 0;
    let catWeightSum = 0;
    let catCriteriaCount = 0;
    let catApplicableCount = 0;
    let catNoEvidenceCount = 0;

    for (const fw of matchedFrameworks) {
      const fwWeight = catDef.frameworkWeights[fw.id] || 100;
      const criteriaBreakdown: CriterionContribution[] = [];
      let fwEarned = 0;
      let fwMax = 0;

      for (const c of fw.criteria) {
        const multiplier = STATUS_MULTIPLIER[c.status] ?? 0;
        const excluded = multiplier === -1;
        const earned = excluded ? 0 : c.weight * multiplier;
        const maxPossible = excluded ? 0 : c.weight;

        fwEarned += earned;
        fwMax += maxPossible;
        catCriteriaCount++;
        if (!excluded) catApplicableCount++;

        if (c.status === 'pass' && (!c.evidence || c.evidence.length === 0)) {
          catNoEvidenceCount++;
        }

        criteriaBreakdown.push({
          id: c.id,
          label: c.label,
          weight: c.weight,
          status: c.status as any,
          multiplier,
          earned,
          maxPossible,
          pctContribution: 0, // computed below
        });
      }

      const fwScore = fwMax > 0 ? Math.round((fwEarned / fwMax) * 100) : 0;

      // Compute per-criterion contribution percentages
      for (const cb of criteriaBreakdown) {
        cb.pctContribution = fwMax > 0 ? Math.round((cb.earned / fwMax) * 100) : 0;
      }

      frameworkBreakdowns.push({
        id: fw.id,
        name: fw.name,
        category: fw.category,
        rawScore: fwScore,
        weight: fwWeight,
        weightedContribution: fwScore * (fwWeight / 100),
        criteria: criteriaBreakdown,
      });

      catRawScore += fwScore * (fwWeight / 100);
      catWeightSum += fwWeight;
    }

    const catFinalScore = catWeightSum > 0 ? Math.round(catRawScore / catWeightSum * 100) : 0;

    categories.push({
      id: catDef.id,
      label: catDef.label,
      rawScore: catFinalScore,
      weight: catDef.weight,
      weightedContribution: catFinalScore * (catDef.weight / 100),
      frameworks: frameworkBreakdowns,
    });

    totalRawScore += catFinalScore * (catDef.weight / 100);
    totalWeight += catDef.weight;
    totalEarnedScore += catFinalScore * (catDef.weight / 100);
    totalMaxScore += 100 * (catDef.weight / 100);

    // Validation: flag low evidence counts
    if (catCriteriaCount > 0 && catNoEvidenceCount > catCriteriaCount * 0.5) {
      allWarnings.push(`${catDef.label}: ${catNoEvidenceCount}/${catCriteriaCount} pass criteria have no evidence quotes`);
    }
  }

  const totalScore = totalWeight > 0 ? Math.round(totalRawScore) : 0;

  /* ── Validation Pass ── */
  const allCriteriaCount = frameworkResults.reduce((s, fw) => s + fw.criteria.length, 0);
  const allApplicableCount = frameworkResults.reduce((s, fw) => s + fw.criteria.filter(c => c.status !== 'not_applicable').length, 0);
  const allPassNoEvidence = frameworkResults.reduce(
    (s, fw) => s + fw.criteria.filter(c => c.status === 'pass' && (!c.evidence || c.evidence.length === 0)).length, 0,
  );

  const relevanceRatio = allCriteriaCount > 0 ? Math.round((allApplicableCount / allCriteriaCount) * 100) : 0;

  // Category imbalance: standard deviation across category scores
  const catScores = categories.map(c => c.rawScore);
  const catMean = catScores.reduce((s, v) => s + v, 0) / catScores.length;
  const catVariance = catScores.reduce((s, v) => s + (v - catMean) ** 2, 0) / catScores.length;
  const categoryImbalance = Math.round(Math.sqrt(catVariance));

  const extremeFlags: string[] = [];
  if (categoryImbalance > 30) {
    extremeFlags.push(`Large category imbalance (σ=${categoryImbalance}): scores range ${Math.min(...catScores)}–${Math.max(...catScores)}`);
  }
  if (relevanceRatio < 50) {
    extremeFlags.push(`Low relevance ratio (${relevanceRatio}%): most criteria marked not applicable`);
  }

  // Confidence score
  let confidence = 100;
  if (allPassNoEvidence > 0) confidence -= allPassNoEvidence * 5; // -5% per un-evidenced pass
  if (categoryImbalance > 20) confidence -= (categoryImbalance - 20) * 2; // -2% per point over 20
  if (relevanceRatio < 60) confidence -= (60 - relevanceRatio) * 1; // -1% per point under 60
  confidence = Math.max(0, Math.min(100, confidence));

  // Validated score: confidence-weighted adjustment
  // If confidence is high (>=80), validated = raw
  // If confidence is low, the validated score moves toward 50 (neutral)
  const validatedScore = confidence >= 80
    ? totalScore
    : Math.round(totalScore * (confidence / 100) + 50 * ((100 - confidence) / 100));

  const totalVerdict = totalScore >= 60 ? 'PASS' : 'FAIL';

  return {
    totalScore,
    validatedScore,
    totalVerdict,
    categories,
    validation: {
      relevanceRatio,
      lowEvidenceCount: allPassNoEvidence,
      categoryImbalance,
      extremeFlags,
      confidence,
      warnings: allWarnings,
    },
  };
}

/**
 * Default category definitions matching framestorm.md
 */
export const DEFAULT_CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'security_compliance',
    label: 'Security & Compliance',
    weight: 25,
    frameworkWeights: { cyber_essentials_2025: 50, gdpr_2018: 50 },
  },
  {
    id: 'technical_troubleshooting',
    label: 'Technical Troubleshooting',
    weight: 25,
    frameworkWeights: { kepner_tregoe: 60, itil_incident_mgmt: 40 },
  },
  {
    id: 'customer_experience',
    label: 'Customer Experience',
    weight: 25,
    frameworkWeights: { servqual: 50, sbar_communication: 25, leap_heat_rubric: 25 },
  },
  {
    id: 'process_professionalism',
    label: 'Process & Professionalism',
    weight: 15,
    frameworkWeights: { itil_service_desk: 100 },
  },
  {
    id: 'msp_custom',
    label: 'MSP Custom',
    weight: 10,
    frameworkWeights: { callum_baseline_v1: 100 },
  },
];
