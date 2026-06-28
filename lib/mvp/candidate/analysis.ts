import { getDb } from '@/lib/mvp/db';
import {
  buildCandidateAnalysis,
  type CandidateAnalysisResult,
} from '@/lib/mvp/analysis/runBaseCallumAnalysis';

export interface CandidateAnalysisPayload {
  status: 'analysed';
  overall_score: number | null;
  readiness_label: string | null;
  summary: string | null;
  strengths: unknown[];
  weaknesses: unknown[];
  checkpoints: Record<string, unknown>;
  structured?: unknown;
}

interface LatestResultRow {
  overall_score: number | null;
  readiness_label: string | null;
  summary: string | null;
  strengths_json: string | null;
  weaknesses_json: string | null;
  checkpoint_json: string | null;
  raw_model_json: string | null;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function buildCandidateAnalysisPayload(row: LatestResultRow): CandidateAnalysisPayload {
  return {
    status: 'analysed',
    overall_score: row.overall_score,
    readiness_label: row.readiness_label,
    summary: row.summary,
    strengths: parseJson<unknown[]>(row.strengths_json, []),
    weaknesses: parseJson<unknown[]>(row.weaknesses_json, []),
    checkpoints: parseJson<Record<string, unknown>>(row.checkpoint_json, {}),
    structured: parseJson<unknown | undefined>(row.raw_model_json, undefined),
  };
}

export function loadCandidateAnalysisForAssessment(
  assessmentId: string,
): { analysis: CandidateAnalysisPayload; candidate_analysis: CandidateAnalysisResult | null } | null {
  const row = getDb().prepare(`
    SELECT r.overall_score, r.readiness_label, r.summary, r.strengths_json, r.weaknesses_json,
           r.checkpoint_json, r.raw_model_json
    FROM assessment_results r
    WHERE r.assessment_id = ?
    ORDER BY r.created_at DESC LIMIT 1
  `).get(assessmentId) as LatestResultRow | undefined;

  if (!row) return null;

  const analysis = buildCandidateAnalysisPayload(row);
  return {
    analysis,
    candidate_analysis: buildCandidateAnalysis(analysis, null),
  };
}
