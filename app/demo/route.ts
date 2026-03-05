import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const res = NextResponse.redirect(`${origin}/dashboard`);
  res.cookies.set('demo_admin', '1', { path: '/', maxAge: 60 * 60 * 24 }); // 24h
  return res;
}
