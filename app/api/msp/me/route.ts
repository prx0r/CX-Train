import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/mvp/db';

/* Get current user's MSP context */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ user: null });

  const db = getDb();
  const msp = db.prepare(`
    SELECT o.*, t.role, t.id as technician_id, t.display_name
    FROM msp_technicians t
    JOIN msp_organisations o ON o.id = t.msp_id
    WHERE t.user_id = ? AND t.active = 1
    LIMIT 1
  `).get(session.user.id) as any;

  return NextResponse.json({
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    msp: msp || null,
  });
}
