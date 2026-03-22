import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const isPublicRoute = (pathname: string) =>
  [
    '/sign-in',
    '/sign-up',
    '/',
    '/demo',
    '/demo/exit',
    '/auth/callback',
    '/api/session',
    '/api/progress',
    '/api/levels/check',
    '/api/upload',
    '/api/webhooks',
  ].some((p) => pathname === p || pathname.startsWith(p + '/'));

export async function updateSession(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // Env vars missing (e.g. not set on Vercel) – pass through; layout will handle auth
      return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    const demoCookie = request.cookies.get('demo_admin')?.value === '1';
    if (!user && !demoCookie && !isPublicRoute(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/sign-in';
      url.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    // Edge/middleware failure – pass through; layout will protect routes
    return NextResponse.next({ request });
  }
}
