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

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "API request failed");
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
