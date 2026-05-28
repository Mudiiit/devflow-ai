import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
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

const BOOTSTRAP_FETCH_TIMEOUT_MS = 15_000;

function resolveBootstrapApiBase(): string {
  const configuredBase =
    process.env.RENDER_EXTERNAL_URL ??
    process.env.API_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_API_URL;

  if (!configuredBase || configuredBase.length === 0) {
    throw new Error('Bootstrap API origin is not configured');
  }

  const normalizedBase = configuredBase.replace(/\/$/, '');

  if (normalizedBase.includes('/api/backend')) {
    throw new Error(`Bootstrap must call the direct Render API origin, not ${normalizedBase}`);
  }

  return normalizedBase;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.info('devflow.auth.bootstrap.fetch.before', {
      input,
      timeoutMs,
      method: init.method,
    });

    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    console.info('devflow.auth.bootstrap.fetch.after', {
      input,
      timeoutMs,
      method: init.method,
      status: response.status,
      ok: response.ok,
    });

    return response;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

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
    console.info('devflow.auth.bootstrap.read_nextauth.before', {
      requestUrl: request.url,
      cookieName,
      secureRequest,
    });

    const token = await getToken({
      req: request,
      secret,
      secureCookie: secureRequest,
      cookieName,
    });

    console.info('devflow.auth.bootstrap.read_nextauth.after', {
      requestUrl: request.url,
      cookieName,
      hasToken: Boolean(token),
      hasGithubAccessToken: Boolean((token as { githubAccessToken?: string } | null)?.githubAccessToken),
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
  try {
    console.info('devflow.auth.bootstrap.start', {
      requestUrl: request.url,
      requestOrigin: request.headers.get('origin') ?? request.nextUrl.origin,
    });

    const returnTo = resolveReturnTo(request);

    console.info('devflow.auth.bootstrap.await.read_nextauth.before', {
      requestUrl: request.url,
      returnTo,
    });
    const nextAuthToken = await readNextAuthToken(request);
    console.info('devflow.auth.bootstrap.await.read_nextauth.after', {
      requestUrl: request.url,
      returnTo,
      hasNextAuthToken: Boolean(nextAuthToken),
      hasGithubAccessToken: Boolean(nextAuthToken?.githubAccessToken),
    });

    const githubAccessToken = nextAuthToken?.githubAccessToken;

    if (!githubAccessToken) {
      console.error('devflow.auth.bootstrap.missing_github_token', {
        requestUrl: request.url,
        returnTo,
      });
      return redirectToLogin(request);
    }

    const apiBase = resolveBootstrapApiBase();
    const bootstrapUrl = `${apiBase}/auth/github/bootstrap`;

    console.info('devflow.auth.bootstrap.await.upstream.before', {
      requestUrl: request.url,
      bootstrapUrl,
      apiBase,
      timeoutMs: BOOTSTRAP_FETCH_TIMEOUT_MS,
    });
    const bootstrapResponse = await fetchWithTimeout(
      bootstrapUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
      BOOTSTRAP_FETCH_TIMEOUT_MS,
    );
    console.info('devflow.auth.bootstrap.await.upstream.after', {
      requestUrl: request.url,
      bootstrapUrl,
      status: bootstrapResponse.status,
      ok: bootstrapResponse.ok,
    });

    if (!bootstrapResponse.ok) {
      console.info('devflow.auth.bootstrap.await.upstream.error_body.before', {
        requestUrl: request.url,
        bootstrapUrl,
        status: bootstrapResponse.status,
      });
      const responseBody = await bootstrapResponse.text().catch(() => null);
      console.info('devflow.auth.bootstrap.await.upstream.error_body.after', {
        requestUrl: request.url,
        bootstrapUrl,
        status: bootstrapResponse.status,
        hasResponseBody: responseBody !== null,
      });
      console.error('devflow.auth.bootstrap.failed', {
        requestUrl: request.url,
        apiUrl: bootstrapResponse.url,
        status: bootstrapResponse.status,
        statusText: bootstrapResponse.statusText,
        responseBody,
      });
      return NextResponse.json(
        {
          message: 'GitHub bootstrap failed',
          status: bootstrapResponse.status,
        },
        { status: 502 },
      );
    }

    console.info('devflow.auth.bootstrap.await.upstream.json.before', {
      requestUrl: request.url,
      bootstrapUrl,
    });
    const payload = (await bootstrapResponse.json()) as BootstrapResponse;
    console.info('devflow.auth.bootstrap.await.upstream.json.after', {
      requestUrl: request.url,
      bootstrapUrl,
      hasAccessToken: Boolean(payload.accessToken),
      hasRefreshToken: Boolean(payload.refreshToken),
      hasCsrfToken: Boolean(payload.csrfToken),
      hasSessionId: Boolean(payload.sessionId),
    });

    const response = NextResponse.redirect(new URL(returnTo, request.url));
    const cookieOptions = buildDevflowAuthCookieOptions();
    const requestCookieNames = request.cookies.getAll().map(({ name }) => name);

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

    console.info('devflow.auth.bootstrap.cookies.set', {
      requestUrl: request.url,
      apiUrl: bootstrapResponse.url,
      status: bootstrapResponse.status,
      requestCookieNames,
      requestHasDevflowAccessToken: requestCookieNames.includes(AUTH_ACCESS_TOKEN_COOKIE),
      requestHasDevflowRefreshToken: requestCookieNames.includes(AUTH_REFRESH_TOKEN_COOKIE),
      requestHasDevflowCsrfToken: requestCookieNames.includes(AUTH_CSRF_COOKIE),
      cookieNamesWritten: [
        AUTH_ACCESS_TOKEN_COOKIE,
        AUTH_REFRESH_TOKEN_COOKIE,
        AUTH_CSRF_COOKIE,
      ],
      cookieOptions,
      responseCookies: response.cookies.getAll().map(({ name, domain, path, secure, sameSite, httpOnly, maxAge, expires }) => ({
        name,
        domain,
        path,
        secure,
        sameSite,
        httpOnly,
        maxAge,
        expires,
      })),
    });

    response.headers.set('Cache-Control', 'no-store');
    console.info('devflow.auth.bootstrap.end', {
      requestUrl: request.url,
      returnTo,
    });
    return response;
  } catch (error) {
    console.error('devflow.auth.bootstrap.unhandled_error', {
      requestUrl: request.url,
      error,
    });
    return NextResponse.json(
      { message: 'GitHub bootstrap failed unexpectedly' },
      { status: 500 },
    );
  }
}