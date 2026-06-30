import { NextResponse } from 'next/server';

/**
 * Trigger processing of pending analysis jobs.
 * Call this from a cron job or manually to retry failed analyses.
 */
export async function POST() {
  const { processPendingJobs } = await import('@/lib/mvp/analysis/jobs');
  const count = processPendingJobs();
  return NextResponse.json({ processed: count });
}
