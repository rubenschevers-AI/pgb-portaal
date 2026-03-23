import { NextResponse, type NextRequest } from 'next/server';

// Optimistic auth check — only verify cookie presence in proxy.
// Full session validation happens in Server Components via lib/supabase/server.ts
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/registreer');
  const hasSession = request.cookies.getAll().some((c) =>
    c.name.startsWith('sb-') && c.name.includes('-auth-token')
  );

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
