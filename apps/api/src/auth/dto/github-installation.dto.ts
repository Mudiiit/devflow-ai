export interface GitHubInstallationLinkDto {
  installationUrl: string;
}

export interface GitHubInstallationSummaryDto {
  id: string;
  githubInstallationId: number;
  githubAccountLogin: string;
  githubAccountType: 'user' | 'organization';
  installationTarget: string | null;
  suspendedAt: Date | null;
}