import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mvp/db';
import { createOrganisation, getOrganisationBySlug, addTechnician, createInvite } from '@/lib/msp';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import crypto from 'crypto';

/* Create MSP org (manager only) */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { name, slug } = body;
  if (!name || !slug) return NextResponse.json({ error: 'Missing name or slug' }, { status: 400 });

  const org = createOrganisation(name, slug);
  addTechnician(session.user.id, org.id, 'manager', session.user.name || 'Manager');

  const invite = createInvite(org.id, 't1', session.user.id);

  return NextResponse.json({
    org,
    invite_url: `${req.nextUrl.origin}/msp/accept-invite/${invite.token}`,
    invite_token: invite.token,
  });
}

/* Get org by slug */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const id = searchParams.get('id');

  const db = getDb();
  let org: any;
  if (slug) org = getOrganisationBySlug(slug);
  else if (id) org = db.prepare('SELECT * FROM msp_organisations WHERE id = ?').get(id);
  else {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    org = db.prepare(`
      SELECT o.* FROM msp_organisations o
      JOIN msp_technicians t ON t.msp_id = o.id
      WHERE t.user_id = ? AND t.active = 1
      LIMIT 1
    `).get(session.user.id);
  }

  if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
  return NextResponse.json({ org });
}
