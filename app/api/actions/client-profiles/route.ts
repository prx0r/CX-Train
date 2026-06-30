import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getDb } from '@/lib/mvp/db';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const db = getDb();
  const msp = db.prepare(`
    SELECT o.id as org_id FROM msp_technicians t
    JOIN msp_organisations o ON o.id = t.msp_id
    WHERE t.user_id = ? AND t.active = 1 LIMIT 1
  `).get(session.user.id) as { org_id: string } | undefined;
  if (!msp) return NextResponse.json({ error: 'No MSP' }, { status: 400 });

  const clients = db.prepare('SELECT * FROM clients WHERE organization_id = ? ORDER BY name').all(msp.org_id);
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const db = getDb();
  const msp = db.prepare(`
    SELECT o.id as org_id FROM msp_technicians t
    JOIN msp_organisations o ON o.id = t.msp_id
    WHERE t.user_id = ? AND t.active = 1 LIMIT 1
  `).get(session.user.id) as { org_id: string } | undefined;
  if (!msp) return NextResponse.json({ error: 'No MSP' }, { status: 400 });

  const body = await req.json();
  const { name, short_name, notes } = body;
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const id = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO clients (id, organization_id, name, short_name, notes) VALUES (?, ?, ?, ?, ?)')
    .run(id, msp.org_id, name, short_name || null, notes || null);

  return NextResponse.json({ client: { id, name, short_name, status: 'active' } });
}
