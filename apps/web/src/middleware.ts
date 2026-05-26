import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const authSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

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

function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  return request.nextUrl.protocol === 'https:' || forwardedProto === 'https' || Boolean(process.env.VERCEL);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const secureRequest = isSecureRequest(request);
  const sessionCookieNames = secureRequest
    ? ['__Secure-next-auth.session-token', 'next-auth.session-token']
    : ['next-auth.session-token', '__Secure-next-auth.session-token'];

  let token = null;

  for (const cookieName of sessionCookieNames) {
    token = await getToken({
      req: request,
      secret: authSecret,
      secureCookie: secureRequest,
      cookieName,
    });

    if (token) {
      break;
    }
  }

  const isAuthenticated = Boolean(token);
  const protectedRoute = isProtectedPath(pathname);

  if (pathname === '/login' && isAuthenticated) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  if (protectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    const callbackUrl = `${pathname}${request.nextUrl.search}`;

    loginUrl.searchParams.set('callbackUrl', callbackUrl);
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
