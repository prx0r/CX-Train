import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (process.env.ENABLE_DEMO !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const origin = request.nextUrl.origin;
  const res = NextResponse.redirect(`${origin}/dashboard`);
  res.cookies.set('demo_admin', '1', { path: '/', maxAge: 60 * 60 * 24 }); // 24h
  return res;
}
