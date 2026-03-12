import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (process.env.ENABLE_DEMO !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const origin = request.nextUrl.origin;
  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.set('demo_admin', '', { path: '/', maxAge: 0 });
  return res;
}
