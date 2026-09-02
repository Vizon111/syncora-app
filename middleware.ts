import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require a signed-in session. Everything else — every
// page and every /api/* route — requires a valid Supabase session cookie.
const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Runs on every request. Two jobs:
 *
 * 1. Refresh the Supabase session (access token) if it's expired, and
 *    re-write the session cookies on the response — this is required by
 *    Supabase's SSR cookie-based auth model, otherwise sessions silently
 *    expire under long-lived pages.
 * 2. Redirect unauthenticated requests away from protected pages/routes.
 *    API routes get a 401 JSON response instead of a redirect, since they're
 *    called by fetch(), not navigated to.
 *
 * This is what replaces the old trust-the-client-supplied-header model: by
 * the time a route handler runs, either this middleware has already
 * confirmed a valid session, or the request never reached the handler.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: no valid session' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already signed in and hitting /login or /signup -> bounce to the app.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and Next.js internals.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
