import { NextRequest, NextResponse } from 'next/server';
import { verifyCallumActionAuth, unauthorizedActionResponse } from '@/lib/actions-auth';
import { getDb } from '@/lib/mvp/db';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  if (!verifyCallumActionAuth(req)) return unauthorizedActionResponse();

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  if (!clientId) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 });

  const db = getDb();
  const protocols = db.prepare(
    'SELECT id, title, protocol_type, rule_text, t1_guidance, escalation_guidance, version FROM client_protocols WHERE client_id = ? AND active = 1 ORDER BY title'
  ).all(clientId);
  return NextResponse.json({ protocols });
}

export async function POST(req: NextRequest) {
  if (!verifyCallumActionAuth(req)) return unauthorizedActionResponse();

  const body = await req.json();
  const { client_id, title, protocol_type, rule_text, t1_guidance, escalation_guidance, trigger_keywords } = body;
  if (!client_id || !title || !protocol_type || !rule_text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO client_protocols (id, client_id, title, protocol_type, trigger_keywords_json, rule_text, t1_guidance, escalation_guidance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, client_id, title, protocol_type, trigger_keywords ? JSON.stringify(trigger_keywords) : null, rule_text, t1_guidance || null, escalation_guidance || null);

  return NextResponse.json({ protocol: { id, title, protocol_type, active: true, version: 1 } });
}
