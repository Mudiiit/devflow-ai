function resolveApiBase(): string {
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
  const cacheKey = init?.cookieHeader ?? "__browser__";
  const cachedContext = organizationContextCache.get(cacheKey);

  if (cachedContext) {
    return cachedContext;
  }

  const contextPromise = (async () => {
    try {
      const headers = new Headers();

      if (init?.cookieHeader) {
        headers.set("Cookie", init.cookieHeader);
      }

      const response = await fetch(`${resolveApiBase()}/organizations/default`, {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return null;
        }

        throw new ApiError("Failed to resolve organization context", {
          status: response.status,
          statusText: response.statusText,
          requestUrl: response.url,
          responseBody: await readResponseBody(response),
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

async function resolveRequestHeaders(
  path: string,
  init?: ApiRequestOptions,
): Promise<Headers> {
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (init?.cookieHeader) {
    headers.set("Cookie", init.cookieHeader);
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

  const response = await fetch(requestUrl, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(`Request failed: ${response.status}`, {
      status: response.status,
      statusText: response.statusText,
      requestUrl,
      responseBody: await readResponseBody(response),
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
  return fetchJson<T>(path, {
    ...init,
    cookieHeader,
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
