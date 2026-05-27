import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { fetchServerApi } from "@/lib/api";

export interface RepositoryOverviewItem {
  readonly id: string;
  readonly name: string;
  readonly fullName: string;
  readonly syncState: "pending" | "syncing" | "ready" | "error" | "disabled";
  readonly language: string | null;
  readonly lastSyncedAt: string | null;
  readonly riskScore: number;
  readonly confidenceScore: number;
  readonly healthScore: number;
}

export interface RepositoryOverviewResponse {
  readonly repositories: RepositoryOverviewItem[];
}

export interface GitHubInstallationLinkResponse {
  readonly installationUrl: string;
}

async function readForwardHeaders(): Promise<Headers> {
  const incomingHeaders = await headers();
  const forwarded = new Headers();

  const cookie = (await cookies()).toString();
  if (cookie) {
    forwarded.set("cookie", cookie);
  }

  const authorization = incomingHeaders.get("authorization");
  if (authorization) {
    forwarded.set("authorization", authorization);
  }

  const orgId = incomingHeaders.get("x-org-id");
  if (orgId) {
    forwarded.set("x-org-id", orgId);
  }

  const workspaceId = incomingHeaders.get("x-workspace-id");
  if (workspaceId) {
    forwarded.set("x-workspace-id", workspaceId);
  }

  return forwarded;
}

export async function getRepositoryOverview(): Promise<RepositoryOverviewResponse> {
  const requestHeaders = await readForwardHeaders();
  return fetchServerApi<RepositoryOverviewResponse>("/dashboard/repositories", undefined, {
    headers: requestHeaders,
  });
}

export async function getGitHubInstallationUrl(returnTo: string): Promise<string> {
  const requestHeaders = await readForwardHeaders();
  const payload = await fetchServerApi<GitHubInstallationLinkResponse>(
    `/integrations/github/install?returnTo=${encodeURIComponent(returnTo)}`,
    undefined,
    {
      headers: requestHeaders,
    },
  );

  return payload.installationUrl;
}