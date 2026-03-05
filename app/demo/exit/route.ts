import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.set('demo_admin', '', { path: '/', maxAge: 0 });
  return res;
}
