import { NextRequest, NextResponse } from 'next/server';
import { verifyCallumActionAuth, unauthorizedActionResponse } from '@/lib/actions-auth';
import { getDb } from '@/lib/mvp/db';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  if (!verifyCallumActionAuth(req)) return unauthorizedActionResponse();

  const db = getDb();
  const clients = db.prepare('SELECT id, name, short_name, status, created_at FROM clients ORDER BY name').all();
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  if (!verifyCallumActionAuth(req)) return unauthorizedActionResponse();

  const body = await req.json();
  const { name, short_name, notes } = body;
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO clients (id, organization_id, name, short_name, notes) VALUES (?, ?, ?, ?, ?)')
    .run(id, 'action-org', name, short_name || null, notes || null);

  return NextResponse.json({ client: { id, name, short_name, status: 'active' } });
}
