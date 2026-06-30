import { getDb } from '../db';
import { makeId } from '../query';

const ANALYSIS_TIMEOUT_MS = 30_000;

export interface AnalysisJobResult {
  status: 'completed' | 'pending' | 'failed';
  analysis?: any;
  error?: string;
}

/**
 * Create a job record when analysis times out or fails.
 */
export function createAnalysisJob(assessmentId: string, sessionId: string | null, error: string): string {
  const db = getDb();
  const id = makeId();
  db.prepare(`
    INSERT INTO analysis_jobs (id, assessment_id, session_id, status, attempts, max_attempts, last_error, run_after, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', 0, 3, ?, datetime('now', '+1 minute'), datetime('now'), datetime('now'))
  `).run(id, assessmentId, sessionId, error);
  return id;
}

/**
 * Run analysis with a timeout. Returns the result if it completes,
 * or creates a background job and returns 'pending'.
 */
export async function runAnalysisWithTimeout(assessmentId: string): Promise<AnalysisJobResult> {
  const { runBaseCallumAnalysis } = await import('./runBaseCallumAnalysis');

  const db = getDb();
  const session = db.prepare('SELECT id FROM sessions WHERE assessment_id = ? ORDER BY started_at DESC LIMIT 1')
    .get(assessmentId) as { id: string } | undefined;
  const sessionId = session?.id || null;

  try {
    const result = await Promise.race([
      runBaseCallumAnalysis(assessmentId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Analysis timeout')), ANALYSIS_TIMEOUT_MS)
      ),
    ]);

    if (result.status === 'analysis_failed') {
      createAnalysisJob(assessmentId, sessionId, result.error || 'Analysis failed');
      return { status: 'pending', error: result.error };
    }

    return { status: 'completed', analysis: result };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    createAnalysisJob(assessmentId, sessionId, errorMsg);
    return { status: 'pending', error: errorMsg };
  }
}

/**
 * Process pending analysis jobs synchronously.
 * Picks up jobs that are due for retry and runs analysis.
 * Returns count of jobs processed.
 */
export function processPendingJobs(): number {
  const db = getDb();
  const jobs = db.prepare(`
    SELECT * FROM analysis_jobs
    WHERE status = 'pending'
      AND (run_after IS NULL OR run_after <= datetime('now'))
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 5
  `).all() as Array<{
    id: string; assessment_id: string; session_id: string | null;
    attempts: number; max_attempts: number; last_error: string | null;
  }>;

  let processed = 0;

  for (const job of jobs) {
    db.prepare(`
      UPDATE analysis_jobs SET status = 'running', attempts = attempts + 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(job.id);

    try {
      /* Dynamically import to avoid circular deps at module level */
      const { runBaseCallumAnalysis } = require('./runBaseCallumAnalysis');
      const analysisResult = runBaseCallumAnalysis(job.assessment_id);

      if (analysisResult.status === 'analysed') {
        try {
          const { normalizeAnalysisScores } = require('./normalize-scores');
          normalizeAnalysisScores(job.assessment_id, analysisResult);
        } catch {}

        db.prepare(`
          UPDATE analysis_jobs SET status = 'completed', last_error = NULL, updated_at = datetime('now')
          WHERE id = ?
        `).run(job.id);
      } else {
        throw new Error(analysisResult.error || 'Analysis failed');
      }
    } catch (err: any) {
      const backoffMinutes = Math.pow(2, job.attempts);
      const isExhausted = job.attempts >= job.max_attempts;
      db.prepare(`
        UPDATE analysis_jobs SET status = ?, last_error = ?, run_after = datetime('now', '+${backoffMinutes} minutes'), updated_at = datetime('now')
        WHERE id = ?
      `).run(isExhausted ? 'failed' : 'pending', err?.message || 'Unknown error', job.id);
    }

    processed++;
  }

  return processed;
}

/**
 * Get job status for polling.
 */
export function getAnalysisJobStatus(assessmentId: string): { status: string; error?: string } | null {
  const db = getDb();
  const job = db.prepare(`
    SELECT status, last_error FROM analysis_jobs
    WHERE assessment_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(assessmentId) as { status: string; last_error: string | null } | undefined;

  if (!job) return null;
  return { status: job.status, error: job.last_error || undefined };
}

/**
 * Check if analysis has completed for an assessment (either directly or via job).
 */
export function isAnalysisComplete(assessmentId: string): boolean {
  const db = getDb();
  const result = db.prepare(
    'SELECT id FROM assessment_results WHERE assessment_id = ? LIMIT 1'
  ).get(assessmentId);
  if (result) return true;

  const job = db.prepare(
    "SELECT status FROM analysis_jobs WHERE assessment_id = ? AND status = 'completed' LIMIT 1"
  ).get(assessmentId);
  return !!job;
}
