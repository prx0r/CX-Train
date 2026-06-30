import { NextRequest, NextResponse } from 'next/server';
import { getAttempts } from '@/lib/candidate/profile';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const attempts = getAttempts(userId, limit);
  return NextResponse.json({ attempts });
}
