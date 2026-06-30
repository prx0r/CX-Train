import { NextRequest, NextResponse } from 'next/server';
import { createInvite, getInviteByToken, redeemInvite, getOrganisation, addTechnician, getTechnician } from '@/lib/msp';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/* Create invite (manager only) */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { msp_id, role, max_uses } = body;
  if (!msp_id || !role) return NextResponse.json({ error: 'Missing msp_id or role' }, { status: 400 });

  const invite = createInvite(msp_id, role, session.user.id, max_uses || 1);
  return NextResponse.json({
    invite,
    invite_url: `${req.nextUrl.origin}/msp/accept-invite/${invite.token}`,
  });
}

/* Redeem invite */
export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { token } = body;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const result = redeemInvite(token);
  if (!result) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });

  const org = getOrganisation(result.mspId);
  if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

  const existing = getTechnician(session.user.id, result.mspId);
  if (!existing) {
    addTechnician(session.user.id, result.mspId, result.role, session.user.name || 'Technician');
  }

  return NextResponse.json({ org, role: result.role });
}

/* Check invite details (no auth needed) */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const invite = getInviteByToken(token);
  if (!invite || !invite.active) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });

  const org = getOrganisation(invite.msp_id);
  return NextResponse.json({
    org_name: org?.name || 'Unknown',
    role: invite.role,
    expires: invite.expires_at,
  });
}
