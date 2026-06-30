import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mvp/db';

/**
 * Polling endpoint for analysis job status.
 * Returns the current status of the latest analysis_job for an assessment.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const assessmentId = params.id;
  const db = getDb();

  /* Check analysis_jobs first */
  const job = db.prepare(`
    SELECT id, status, attempts, max_attempts, last_error, created_at, updated_at
    FROM analysis_jobs
    WHERE assessment_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(assessmentId) as {
    id: string; status: string; attempts: number; max_attempts: number;
    last_error: string | null; created_at: string; updated_at: string;
  } | undefined;

  if (job) {
    const done = job.status === 'completed' || job.status === 'failed';
    return NextResponse.json({
      status: job.status,
      done,
      attempts: job.attempts,
      max_attempts: job.max_attempts,
      error: job.last_error,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      jobId: job.id,
    });
  }

  /* Check if analysis already completed directly */
  const result = db.prepare(
    'SELECT id, status FROM assessment_results WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(assessmentId) as { id: string; status?: string } | undefined;

  if (result) {
    return NextResponse.json({ status: 'completed', done: true, resultId: result.id });
  }

  return NextResponse.json({ status: 'not_found', done: false });
}
