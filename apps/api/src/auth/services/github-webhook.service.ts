import { Injectable } from '@nestjs/common';
import type {
  GitHubInstallationPayload,
  GitHubPullRequestWebhookPayload,
  GitHubRepositoryWebhookPayload,
} from '../auth.types.js';
import type {
  GitHubWebhookDto,
  GitHubWebhookIngestionResultDto,
} from '../dto/github-webhook.dto.js';
import { RepositorySyncService } from './repository-sync.service.js';

@Injectable()
export class GitHubWebhookService {
  constructor(private readonly repositorySyncService: RepositorySyncService) {}

  async handleWebhook(
    event: GitHubWebhookDto['event'],
    body: Buffer,
  ): Promise<GitHubWebhookIngestionResultDto> {
    const payload = this.parseWebhookPayload(event, body);

    switch (payload.event) {
      case 'installation':
      case 'installation_repositories':
        await this.repositorySyncService.applyInstallationWebhook(
          payload.payload,
        );
        break;
      case 'repository':
        await this.repositorySyncService.applyRepositoryWebhook(
          payload.payload as GitHubRepositoryWebhookPayload,
        );
        break;
      case 'pull_request':
        await this.repositorySyncService.createReviewJobFromPullRequestWebhook(
          payload.payload as GitHubPullRequestWebhookPayload,
        );
        break;
      default:
        return { received: true, processed: false, event: payload.event };
    }

    return { received: true, processed: true, event: payload.event };
  }

  private parseWebhookPayload(
    event: GitHubWebhookDto['event'],
    body: Buffer,
  ): GitHubWebhookDto {
    const parsed = JSON.parse(body.toString('utf8')) as unknown;

    if (!this.isRecord(parsed)) {
      throw new Error('GitHub webhook payload must be an object');
    }

    if (event === 'installation' || event === 'installation_repositories') {
      return { event, payload: parsed as unknown as GitHubInstallationPayload };
    }

    if (event === 'repository') {
      return {
        event,
        payload: parsed as unknown as GitHubRepositoryWebhookPayload,
      };
    }

    if (event === 'pull_request') {
      return {
        event,
        payload: parsed as unknown as GitHubPullRequestWebhookPayload,
      };
    }

    throw new Error(`Unsupported GitHub webhook event: ${event}`);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
