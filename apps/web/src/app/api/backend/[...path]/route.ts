import { NextRequest, NextResponse } from 'next/server';
import { getApiBase } from '@/lib/api';

const AUTH_ACCESS_TOKEN_COOKIE = 'devflow_access_token';
const AUTH_CSRF_COOKIE = 'devflow_csrf_token';

const proxyMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function readCookie(cookieHeader: string, name: string): string | null {
  for (const segment of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = segment.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}

function buildTargetUrl(
  request: NextRequest,
  params: { path?: string[] },
): URL {
  const apiBase = getApiBase();
  const path = `/${(params.path ?? []).join('/')}`;
  return new URL(`${path}${request.nextUrl.search}`, apiBase);
}

function cleanRequestHeaders(headers: Headers): Headers {
  const forwarded = new Headers(headers);
  forwarded.delete('host');
  forwarded.delete('content-length');
  forwarded.delete('connection');
  forwarded.delete('accept-encoding');
  forwarded.delete('origin');
  forwarded.delete('referer');
  return forwarded;
}

function buildCookieHeader(request: NextRequest): string | null {
  const headerCookie = request.headers.get('cookie');

  if (headerCookie) {
    return headerCookie;
  }

  const cookies = request.cookies.getAll();
  if (cookies.length === 0) {
    return null;
  }

  return cookies
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
}

async function proxyRequest(request: NextRequest, context: RouteContext): Promise<Response> {
  const targetUrl = buildTargetUrl(request, await context.params);
  const requestHeaders = cleanRequestHeaders(request.headers);
  const cookieHeader = buildCookieHeader(request);
  const requestCookieNames = request.cookies.getAll().map(({ name }) => name);
  const accessToken = cookieHeader ? readCookie(cookieHeader, AUTH_ACCESS_TOKEN_COOKIE) : null;
  const csrfToken = cookieHeader ? readCookie(cookieHeader, AUTH_CSRF_COOKIE) : null;
  const bearerInjected = Boolean(accessToken && !requestHeaders.has('authorization'));

  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader);
  }

  if (bearerInjected) {
    requestHeaders.set('authorization', `Bearer ${accessToken}`);
  }

  if (csrfToken && !requestHeaders.has('x-csrf-token')) {
    requestHeaders.set('x-csrf-token', csrfToken);
  }

  console.info('web.api.proxy.start', {
    method: request.method,
    requestUrl: request.url,
    requestOrigin: request.headers.get('origin') ?? request.nextUrl.origin,
    targetUrl: targetUrl.toString(),
    requestCookieNames,
    requestCanReadDevflowAccessToken: requestCookieNames.includes(AUTH_ACCESS_TOKEN_COOKIE),
    requestCanReadDevflowCsrfToken: requestCookieNames.includes(AUTH_CSRF_COOKIE),
    hasAuthCookies: Boolean(accessToken || csrfToken),
    hasCookieHeader: Boolean(cookieHeader),
    hasAuthorization: requestHeaders.has('authorization'),
    bearerInjected,
    hasCsrfToken: Boolean(csrfToken),
  });

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: requestHeaders,
    body: proxyMethods.includes(request.method as (typeof proxyMethods)[number]) && request.method !== 'GET' && request.method !== 'HEAD'
      ? request.body
      : undefined,
    cache: 'no-store',
    credentials: 'include',
    redirect: 'manual',
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');

  const forwardedResponse = new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });

  const setCookieHeaders =
    typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie') as string] : []);

  for (const setCookieHeader of setCookieHeaders) {
    forwardedResponse.headers.append('set-cookie', setCookieHeader);
  }

  console.info('web.api.proxy.end', {
    method: request.method,
    requestUrl: request.url,
    requestOrigin: request.headers.get('origin') ?? request.nextUrl.origin,
    targetUrl: targetUrl.toString(),
    status: response.status,
  });

  return forwardedResponse;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}