import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAttempts } from '@/lib/candidate/profile';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  /* Verify the session user matches the requested userId */
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.id !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const attempts = getAttempts(userId, limit);
  return NextResponse.json({ attempts });
}
