function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/backend`;
  }

  const configuredBase = process.env.NEXT_PUBLIC_API_URL;

  if (!configuredBase || configuredBase.length === 0) {
    throw new Error("NEXT_PUBLIC_API_URL is required to call the API");
  }

  return configuredBase.replace(/\/$/, "");
}

export function getApiBase(): string {
  return resolveApiBase();
}

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly requestUrl: string;
  readonly responseBody: unknown;

  constructor(
    message: string,
    input: {
      status: number;
      statusText: string;
      requestUrl: string;
      responseBody: unknown;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = input.status;
    this.statusText = input.statusText;
    this.requestUrl = input.requestUrl;
    this.responseBody = input.responseBody;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type ApiRequestOptions = RequestInit & {
  readonly cookieHeader?: string;
  readonly skipOrganizationContext?: boolean;
  readonly skipRefreshOnUnauthorized?: boolean;
};

type OrganizationContext = {
  readonly organizationId: string;
  readonly workspaceId: string;
};

type DefaultOrganizationResponse = {
  readonly organization: { readonly id: string } | null;
  readonly membership: { readonly organizationId: string } | null;
};

const organizationContextCache = new Map<string, Promise<OrganizationContext | null>>();

const AUTH_ACCESS_TOKEN_COOKIE = "devflow_access_token";
const AUTH_REFRESH_TOKEN_COOKIE = "devflow_refresh_token";
const AUTH_CSRF_COOKIE = "devflow_csrf_token";
const NEXT_AUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function readHeaderValue(
  headers: Headers,
  name: string,
): string | null {
  const value = headers.get(name);
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  for (const segment of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = segment.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

function listCookieNames(cookieHeader: string | null): string[] {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((segment) => segment.trim().split("=")[0] ?? "")
    .filter((name) => name.length > 0);
}

function hasCookie(cookieHeader: string | null, name: string): boolean {
  return listCookieNames(cookieHeader).includes(name);
}

function buildAuthState(cookieHeader: string | null, headers: Headers) {
  return {
    cookieNames: listCookieNames(cookieHeader),
    hasCookie: Boolean(cookieHeader),
    hasDevflowAccessToken: hasCookie(cookieHeader, AUTH_ACCESS_TOKEN_COOKIE),
    hasDevflowRefreshToken: hasCookie(cookieHeader, AUTH_REFRESH_TOKEN_COOKIE),
    hasDevflowCsrfToken: hasCookie(cookieHeader, AUTH_CSRF_COOKIE),
    hasNextAuthSession: NEXT_AUTH_COOKIE_NAMES.some((name) => hasCookie(cookieHeader, name)),
    hasAuthorization: Boolean(readHeaderValue(headers, "authorization")),
    hasOrgId: Boolean(readHeaderValue(headers, "x-org-id")),
    hasWorkspaceId: Boolean(readHeaderValue(headers, "x-workspace-id")),
  };
}

function buildOrganizationContextCacheKey(init?: ApiRequestOptions): string {
  const requestHeaders = new Headers(init?.headers);
  const cookiePart = init?.cookieHeader ?? readHeaderValue(requestHeaders, "cookie") ?? "";
  const authorizationPart = readHeaderValue(requestHeaders, "authorization") ?? "";
  const orgIdPart = readHeaderValue(requestHeaders, "x-org-id") ?? "";
  const workspaceIdPart = readHeaderValue(requestHeaders, "x-workspace-id") ?? "";

  return [cookiePart, authorizationPart, orgIdPart, workspaceIdPart].join("::");
}

function logSsrApiFailure(input: {
  readonly reason: "response_not_ok" | "request_error";
  readonly path: string;
  readonly requestUrl: string;
  readonly method: string;
  readonly status?: number;
  readonly statusText?: string;
  readonly hasCookie: boolean;
  readonly cookieNames?: string[];
  readonly hasDevflowAccessToken?: boolean;
  readonly hasDevflowRefreshToken?: boolean;
  readonly hasDevflowCsrfToken?: boolean;
  readonly hasNextAuthSession?: boolean;
  readonly hasAuthorization: boolean;
  readonly hasOrgId: boolean;
  readonly hasWorkspaceId: boolean;
  readonly responseBody?: unknown;
  readonly error?: unknown;
}): void {
  if (typeof window !== "undefined") {
    return;
  }

  console.error("ssr.api.fetch.failed", {
    reason: input.reason,
    path: input.path,
    requestUrl: input.requestUrl,
    method: input.method,
    status: input.status,
    statusText: input.statusText,
    hasCookie: input.hasCookie,
    cookieNames: input.cookieNames ?? [],
    hasDevflowAccessToken: input.hasDevflowAccessToken,
    hasDevflowRefreshToken: input.hasDevflowRefreshToken,
    hasDevflowCsrfToken: input.hasDevflowCsrfToken,
    hasNextAuthSession: input.hasNextAuthSession,
    hasAuthorization: input.hasAuthorization,
    hasOrgId: input.hasOrgId,
    hasWorkspaceId: input.hasWorkspaceId,
    responseBody: input.responseBody,
    error: input.error,
  });
}

const protectedApiPrefixes = [
  "/dashboard",
  "/billing",
  "/repositories",
  "/pull-requests",
  "/reviews",
  "/analytics",
  "/settings",
];

function normalizePath(path: string): string {
  return path.split("?")[0] ?? path;
}

function shouldAttachOrganizationContext(path: string): boolean {
  const pathname = normalizePath(path);

  if (pathname === "/organizations/default") {
    return false;
  }

  return protectedApiPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function fetchOrganizationContext(
  init?: ApiRequestOptions,
): Promise<OrganizationContext | null> {
  const cacheKey = buildOrganizationContextCacheKey(init);
  const cachedContext = organizationContextCache.get(cacheKey);

  if (cachedContext) {
    return cachedContext;
  }

  const contextPromise = (async () => {
    try {
      const headers = new Headers(init?.headers);
      const cookieHeader = init?.cookieHeader ?? readHeaderValue(headers, "cookie") ?? null;

      if (cookieHeader) {
        headers.set("Cookie", cookieHeader);
      }

      const response = await fetch(`${resolveApiBase()}/organizations/default`, {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        const responseBody = await readResponseBody(response);

        logSsrApiFailure({
          reason: "response_not_ok",
          path: "/organizations/default",
          requestUrl: response.url,
          method: "GET",
          status: response.status,
          statusText: response.statusText,
          hasCookie: Boolean(cookieHeader),
          cookieNames: listCookieNames(cookieHeader),
          hasDevflowAccessToken: hasCookie(cookieHeader, AUTH_ACCESS_TOKEN_COOKIE),
          hasDevflowRefreshToken: hasCookie(cookieHeader, AUTH_REFRESH_TOKEN_COOKIE),
          hasDevflowCsrfToken: hasCookie(cookieHeader, AUTH_CSRF_COOKIE),
          hasNextAuthSession: NEXT_AUTH_COOKIE_NAMES.some((name) => hasCookie(cookieHeader, name)),
          hasAuthorization: Boolean(readHeaderValue(headers, "authorization")),
          hasOrgId: Boolean(readHeaderValue(headers, "x-org-id")),
          hasWorkspaceId: Boolean(readHeaderValue(headers, "x-workspace-id")),
          responseBody,
        });

        if (response.status === 401 || response.status === 403) {
          return null;
        }

        throw new ApiError("Failed to resolve organization context", {
          status: response.status,
          statusText: response.statusText,
          requestUrl: response.url,
          responseBody,
        });
      }

      const payload = (await response.json()) as DefaultOrganizationResponse;
      const organizationId =
        payload.organization?.id ?? payload.membership?.organizationId ?? null;

      if (!organizationId) {
        return null;
      }

      return {
        organizationId,
        workspaceId: organizationId,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      return null;
    }
  })();

  const cachedPromise = contextPromise.then((context) => {
    if (!context) {
      organizationContextCache.delete(cacheKey);
    }

    return context;
  });

  organizationContextCache.set(cacheKey, cachedPromise);
  return cachedPromise;
}

async function refreshServerSession(init?: ApiRequestOptions): Promise<string | null> {
  if (typeof window !== "undefined") {
    return null;
  }

  const headers = new Headers(init?.headers);
  const cookieHeader = init?.cookieHeader ?? readHeaderValue(headers, "cookie") ?? null;

  if (!cookieHeader) {
    return null;
  }

  const csrfToken = readCookieValue(cookieHeader, AUTH_CSRF_COOKIE);
  if (!csrfToken) {
    return null;
  }

  headers.set("Cookie", cookieHeader);
  headers.set("x-csrf-token", csrfToken);
  headers.set("Content-Type", "application/json");

  console.info("ssr.api.refresh.start", {
    cookieNames: listCookieNames(cookieHeader),
    hasDevflowAccessToken: hasCookie(cookieHeader, AUTH_ACCESS_TOKEN_COOKIE),
    hasDevflowRefreshToken: hasCookie(cookieHeader, AUTH_REFRESH_TOKEN_COOKIE),
    hasDevflowCsrfToken: hasCookie(cookieHeader, AUTH_CSRF_COOKIE),
    hasNextAuthSession: NEXT_AUTH_COOKIE_NAMES.some((name) => hasCookie(cookieHeader, name)),
  });

  const response = await fetch(`${resolveApiBase()}/auth/refresh`, {
    method: "POST",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = await readResponseBody(response);
    console.info("ssr.api.refresh.failed", {
      status: response.status,
      statusText: response.statusText,
      responseBody,
      cookieNames: listCookieNames(cookieHeader),
    });
    return null;
  }

  const payload = (await response.json()) as { readonly accessToken?: string };
  const accessToken = payload.accessToken ?? null;

  console.info("ssr.api.refresh.succeeded", {
    cookieNames: listCookieNames(cookieHeader),
    hasAccessToken: Boolean(accessToken),
  });

  return accessToken;
}

async function resolveRequestHeaders(
  path: string,
  init?: ApiRequestOptions,
): Promise<Headers> {
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const cookieHeader = init?.cookieHeader ?? readHeaderValue(headers, "cookie");
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  if (init?.skipOrganizationContext || !shouldAttachOrganizationContext(path)) {
    return headers;
  }

  const organizationContext = await fetchOrganizationContext(init);
  if (!organizationContext) {
    return headers;
  }

  headers.set("x-org-id", organizationContext.organizationId);
  headers.set("x-workspace-id", organizationContext.workspaceId);

  return headers;
}

async function resolveRequestUrl(
  path: string,
  init?: ApiRequestOptions,
): Promise<string> {
  const url = new URL(`${resolveApiBase()}${path}`);

  if (!shouldAttachOrganizationContext(path) || init?.skipOrganizationContext) {
    return url.toString();
  }

  const organizationContext = await fetchOrganizationContext(init);
  if (!organizationContext) {
    return url.toString();
  }

  url.searchParams.set("orgId", organizationContext.organizationId);
  url.searchParams.set("organizationId", organizationContext.organizationId);
  url.searchParams.set("workspaceId", organizationContext.workspaceId);
  return url.toString();
}

async function fetchJson<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  const headers = await resolveRequestHeaders(path, init);
  const requestUrl = await resolveRequestUrl(path, init);
  const method = init?.method ?? "GET";
  const cookieHeader = readHeaderValue(headers, "cookie");
  const authState = buildAuthState(cookieHeader, headers);

  if (typeof window === "undefined") {
    console.info("ssr.api.fetch.start", {
      path,
      requestUrl,
      method,
      ...authState,
    });
  }

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    logSsrApiFailure({
      reason: "request_error",
      path,
      requestUrl,
      method,
      hasCookie: authState.hasCookie,
      cookieNames: authState.cookieNames,
      hasDevflowAccessToken: authState.hasDevflowAccessToken,
      hasDevflowRefreshToken: authState.hasDevflowRefreshToken,
      hasDevflowCsrfToken: authState.hasDevflowCsrfToken,
      hasNextAuthSession: authState.hasNextAuthSession,
      hasAuthorization: authState.hasAuthorization,
      hasOrgId: authState.hasOrgId,
      hasWorkspaceId: authState.hasWorkspaceId,
      error,
    });
    throw error;
  }

  if (!response.ok) {
    const responseBody = await readResponseBody(response);

    if (
      response.status === 401 &&
      typeof window === "undefined" &&
      !init?.skipRefreshOnUnauthorized
    ) {
      const refreshedAccessToken = await refreshServerSession(init);

      if (refreshedAccessToken) {
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set("Authorization", `Bearer ${refreshedAccessToken}`);

        return fetchJson<T>(path, {
          ...init,
          headers: retryHeaders,
          skipRefreshOnUnauthorized: true,
        });
      }
    }

    logSsrApiFailure({
      reason: "response_not_ok",
      path,
      requestUrl,
      method,
      status: response.status,
      statusText: response.statusText,
      hasCookie: authState.hasCookie,
      cookieNames: authState.cookieNames,
      hasDevflowAccessToken: authState.hasDevflowAccessToken,
      hasDevflowRefreshToken: authState.hasDevflowRefreshToken,
      hasDevflowCsrfToken: authState.hasDevflowCsrfToken,
      hasNextAuthSession: authState.hasNextAuthSession,
      hasAuthorization: authState.hasAuthorization,
      hasOrgId: authState.hasOrgId,
      hasWorkspaceId: authState.hasWorkspaceId,
      responseBody,
    });

    throw new ApiError(`Request failed: ${response.status}`, {
      status: response.status,
      statusText: response.statusText,
      requestUrl,
      responseBody,
    });
  }

  return (await response.json()) as T;
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(path, {
    ...init,
    credentials: "include",
  });
}

export async function fetchServerApi<T>(path: string, cookieHeader?: string, init?: RequestInit): Promise<T> {
  const requestHeaders = new Headers(init?.headers);
  const forwardedCookie = cookieHeader ?? readHeaderValue(requestHeaders, "cookie") ?? undefined;

  if (forwardedCookie) {
    requestHeaders.set("Cookie", forwardedCookie);
  }

  return fetchJson<T>(path, {
    ...init,
    headers: requestHeaders,
    cookieHeader: forwardedCookie,
    credentials: "include",
  });
}

export async function buildApiUrl(path: string, init?: ApiRequestOptions): Promise<string> {
  return resolveRequestUrl(path, init);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    return await response.text();
  } catch {
    return null;
  }
}
