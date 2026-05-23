import type { GitHubInstallationPayload } from '../auth.types.js';

export interface GitHubWebhookDto {
  event: string;
  payload: GitHubInstallationPayload;
}