import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFeaturedAttempts, toggleFeatured, updateFeaturedSettings } from '@/lib/candidate/profile';
import { headers } from 'next/headers';

async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const sessionUserId = await getSessionUserId();
  if (sessionUserId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const featured = getFeaturedAttempts(userId);
  return NextResponse.json({ featured });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, assessmentId, featured } = body;
  if (!userId || !assessmentId) return NextResponse.json({ error: 'Missing userId or assessmentId' }, { status: 400 });

  const sessionUserId = await getSessionUserId();
  if (sessionUserId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  toggleFeatured(userId, assessmentId, featured);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { userId, assessmentId, ...settings } = body;
  if (!userId || !assessmentId) return NextResponse.json({ error: 'Missing userId or assessmentId' }, { status: 400 });

  const sessionUserId = await getSessionUserId();
  if (sessionUserId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  updateFeaturedSettings(userId, assessmentId, settings);
  return NextResponse.json({ ok: true });
}
