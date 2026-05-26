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
  "/notifications",
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
        credentials: init?.cookieHeader ? "omit" : "include",
        cache: "no-store",
      });

      if (!response.ok) {
        return null;
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
    } catch {
      return null;
    }
  })();

  organizationContextCache.set(cacheKey, contextPromise);
  return contextPromise;
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

async function fetchJson<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  const headers = await resolveRequestHeaders(path, init);

  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "API request failed");
    throw new Error(message || `Request failed: ${response.status}`);
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
  });
}

export async function buildApiUrl(path: string, init?: ApiRequestOptions): Promise<string> {
  if (!shouldAttachOrganizationContext(path) || init?.skipOrganizationContext) {
    return `${resolveApiBase()}${path}`;
  }

  const organizationContext = await fetchOrganizationContext(init);
  if (!organizationContext) {
    return `${resolveApiBase()}${path}`;
  }

  const url = new URL(`${resolveApiBase()}${path}`);
  url.searchParams.set("orgId", organizationContext.organizationId);
  url.searchParams.set("workspaceId", organizationContext.workspaceId);
  return url.toString();
}
