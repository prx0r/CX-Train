import { NextRequest, NextResponse } from 'next/server';
import { listTechnicians, updateTechnicianRole, getTechnician } from '@/lib/msp';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/mvp/db';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const mspId = searchParams.get('msp_id');
  if (!mspId) return NextResponse.json({ error: 'Missing msp_id' }, { status: 400 });

  const techs = listTechnicians(mspId);
  /* Enrich with user details */
  const db = getDb();
  const enriched = techs.map(t => {
    const user = db.prepare('SELECT name, email FROM user WHERE id = ?').get(t.user_id) as any;
    return { ...t, user_name: user?.name || 'Unknown', user_email: user?.email || '' };
  });

  return NextResponse.json({ technicians: enriched });
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { technician_id, role } = body;
  if (!technician_id || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  updateTechnicianRole(technician_id, role);
  return NextResponse.json({ ok: true });
}
