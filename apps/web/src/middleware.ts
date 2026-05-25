import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

if (!process.env.NEXTAUTH_SECRET) {
  console.warn('[web][nextauth][middleware] NEXTAUTH_SECRET is missing; token decoding may fail and all users will appear unauthenticated');
}

const protectedPrefixes = [
  '/dashboard',
  '/repositories',
  '/pull-requests',
  '/reviews',
  '/notifications',
  '/analytics',
  '/settings',
];

function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isAuthenticated = Boolean(token);
  const protectedRoute = isProtectedPath(pathname);

  console.info(
    '[web][nextauth][middleware] path=%s isProtected=%s isAuthenticated=%s',
    pathname,
    protectedRoute,
    isAuthenticated,
  );

  if (pathname === '/login' && isAuthenticated) {
    const dashboardUrl = new URL('/dashboard', request.url);
    console.info('[web][nextauth][middleware] redirecting authenticated user from /login to %s', dashboardUrl.toString());
    return NextResponse.redirect(dashboardUrl);
  }

  if (protectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    const callbackUrl = `${pathname}${request.nextUrl.search}`;

    loginUrl.searchParams.set('callbackUrl', callbackUrl);
    console.info('[web][nextauth][middleware] redirecting unauthenticated request to %s', loginUrl.toString());
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/repositories/:path*',
    '/pull-requests/:path*',
    '/reviews/:path*',
    '/notifications/:path*',
    '/analytics/:path*',
    '/settings/:path*',
  ],
};
