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
  repositoryCount: number;
  syncState: 'pending' | 'syncing' | 'ready' | 'error' | 'disabled';
  lastSyncAt: Date | null;
}

export interface GitHubRepositorySummaryDto {
  id: string;
  githubRepositoryId: number;
  githubInstallationId: string;
  ownerLogin: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  visibility: 'public' | 'private' | 'internal';
  syncState: 'pending' | 'syncing' | 'ready' | 'error' | 'disabled';
  isArchived: boolean;
  isFork: boolean;
  language: string | null;
  lastSyncedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface GitHubInstallationStatusDto extends GitHubInstallationSummaryDto {
  metadata: Record<string, unknown>;
  repositories: GitHubRepositorySummaryDto[];
}

export interface GitHubRepositoryConnectionDto {
  installation: GitHubInstallationStatusDto;
  repository: GitHubRepositorySummaryDto;
}

export interface GitHubInstallationSyncDto {
  synced: number;
  installation: GitHubInstallationStatusDto;
}

export interface GitHubReviewJobDto {
  id: string;
  repositoryId: string;
  pullRequestId: string;
  status: 'queued' | 'leased' | 'chunking' | 'analyzing' | 'summarizing' | 'processing' | 'completed' | 'failed' | 'cancelled';
  jobType: 'pull_request_review' | 'comment_followup' | 'retriage' | 'embedding_refresh';
  priority: number;
}
