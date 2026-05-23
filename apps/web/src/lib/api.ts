import { clientEnv } from "@devflow/config";

const apiBase = clientEnv.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
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
