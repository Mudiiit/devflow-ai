import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getApiBase } from '@/lib/api';
import { buildDevflowAuthCookieOptions } from '@/lib/devflow-cookies';

const AUTH_ACCESS_TOKEN_COOKIE = 'devflow_access_token';
const AUTH_REFRESH_TOKEN_COOKIE = 'devflow_refresh_token';
const AUTH_CSRF_COOKIE = 'devflow_csrf_token';

type BootstrapResponse = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly csrfToken: string;
  readonly sessionId: string;
};

function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  return request.nextUrl.protocol === 'https:' || forwardedProto === 'https' || Boolean(process.env.VERCEL);
}

async function readNextAuthToken(request: NextRequest) {
  const secureRequest = isSecureRequest(request);
  const sessionCookieNames = secureRequest
    ? ['__Secure-next-auth.session-token', 'next-auth.session-token']
    : ['next-auth.session-token', '__Secure-next-auth.session-token'];
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

  for (const cookieName of sessionCookieNames) {
    const token = await getToken({
      req: request,
      secret,
      secureCookie: secureRequest,
      cookieName,
    });

    if (token) {
      return token as { githubAccessToken?: string };
    }
  }

  return null;
}

function resolveReturnTo(request: NextRequest): string {
  const rawReturnTo = request.nextUrl.searchParams.get('returnTo');

  if (!rawReturnTo) {
    return '/dashboard';
  }

  try {
    const parsed = new URL(rawReturnTo, request.url);
    if (parsed.origin !== request.nextUrl.origin) {
      return '/dashboard';
    }

    const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return candidate.startsWith('/') ? candidate : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', '/dashboard');
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = resolveReturnTo(request);
  const nextAuthToken = await readNextAuthToken(request);
  const githubAccessToken = nextAuthToken?.githubAccessToken;

  if (!githubAccessToken) {
    console.error('devflow.auth.bootstrap.missing_github_token', {
      requestUrl: request.url,
      returnTo,
    });
    return redirectToLogin(request);
  }

  const bootstrapResponse = await fetch(`${getApiBase()}/auth/github/bootstrap`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubAccessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!bootstrapResponse.ok) {
    const responseBody = await bootstrapResponse.text().catch(() => null);
    console.error('devflow.auth.bootstrap.failed', {
      requestUrl: request.url,
      apiUrl: bootstrapResponse.url,
      status: bootstrapResponse.status,
      statusText: bootstrapResponse.statusText,
      responseBody,
    });
    return redirectToLogin(request);
  }

  const payload = (await bootstrapResponse.json()) as BootstrapResponse;
  const response = NextResponse.redirect(new URL(returnTo, request.url));
  const cookieOptions = buildDevflowAuthCookieOptions();

  response.cookies.set(AUTH_ACCESS_TOKEN_COOKIE, payload.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60,
  });
  response.cookies.set(AUTH_REFRESH_TOKEN_COOKIE, payload.refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60,
  });
  response.cookies.set(AUTH_CSRF_COOKIE, payload.csrfToken, {
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    ...(cookieOptions.domain ? { domain: cookieOptions.domain } : {}),
    maxAge: 30 * 24 * 60 * 60,
  });

  response.headers.set('Cache-Control', 'no-store');
  return response;
}