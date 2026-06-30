import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/callum-actions';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/mvp/db';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '7', 10);

  const db = getDb();
  const msp = db.prepare(`
    SELECT o.id as org_id, t.role FROM msp_technicians t
    JOIN msp_organisations o ON o.id = t.msp_id
    WHERE t.user_id = ? AND t.active = 1 LIMIT 1
  `).get(session.user.id) as { org_id: string; role: string } | undefined;
  if (!msp) return NextResponse.json({ error: 'No MSP' }, { status: 400 });

  const stats = getDashboardStats(msp.org_id, days);
  return NextResponse.json({ stats, period_days: days });
}
