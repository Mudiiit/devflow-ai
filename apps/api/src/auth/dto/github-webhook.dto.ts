import type { GitHubInstallationPayload, GitHubPullRequestWebhookPayload, GitHubRepositoryWebhookPayload } from '../auth.types.js';

export type GitHubWebhookEvent = 'installation' | 'installation_repositories' | 'repository' | 'pull_request';

export type GitHubWebhookPayload = GitHubInstallationPayload | GitHubRepositoryWebhookPayload | GitHubPullRequestWebhookPayload;

export interface GitHubWebhookDto {
  event: GitHubWebhookEvent;
  payload: GitHubWebhookPayload;
}

export interface GitHubWebhookIngestionResultDto {
  received: true;
  processed: boolean;
  event: GitHubWebhookEvent;
}