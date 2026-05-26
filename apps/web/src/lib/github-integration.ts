import "server-only";

import { cookies } from "next/headers";
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

function readCookieHeader(): string {
  return cookies().toString();
}

export async function getRepositoryOverview(): Promise<RepositoryOverviewResponse> {
  return fetchServerApi<RepositoryOverviewResponse>("/dashboard/repositories", readCookieHeader());
}

export async function getGitHubInstallationUrl(returnTo: string): Promise<string> {
  const payload = await fetchServerApi<GitHubInstallationLinkResponse>(
    `/integrations/github/install?returnTo=${encodeURIComponent(returnTo)}`,
    readCookieHeader(),
  );

  return payload.installationUrl;
}