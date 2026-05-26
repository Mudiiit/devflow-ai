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
};

async function fetchJson<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (init?.cookieHeader) {
    headers.set("Cookie", init.cookieHeader);
  }

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
