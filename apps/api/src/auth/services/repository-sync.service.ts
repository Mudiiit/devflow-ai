import { Injectable } from '@nestjs/common';
import { GithubInstallationsRepository, PullRequestsRepository, RepositoriesRepository, ReviewJobsRepository, type GithubInstallation, type NewRepository, type Repository, type ReviewJob } from '@devflow/database';
import { GitHubAppService } from './github-app.service.js';
import type {
  GitHubInstallationPayload,
  GitHubPullRequestWebhookPayload,
  GitHubRepositoryIdentity,
  GitHubRepositoryWebhookPayload,
} from '../auth.types.js';
import type {
  GitHubInstallationStatusDto,
  GitHubInstallationSyncDto,
  GitHubInstallationSummaryDto,
  GitHubRepositoryConnectionDto,
  GitHubRepositorySummaryDto,
  GitHubReviewJobDto,
} from '../dto/github-installation.dto.js';

@Injectable()
export class RepositorySyncService {
  constructor(
    private readonly githubAppService: GitHubAppService,
    private readonly githubInstallationsRepository: GithubInstallationsRepository,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly pullRequestsRepository: PullRequestsRepository,
    private readonly reviewJobsRepository: ReviewJobsRepository,
  ) {}

  async listInstallationsForUser(userId: string): Promise<GitHubInstallationSummaryDto[]> {
    const installations = await this.githubInstallationsRepository.findManyByCreatedByUserId(userId);
    const visibleInstallations = installations.length > 0 ? installations : await this.githubInstallationsRepository.findAll();

    return Promise.all(visibleInstallations.map(async (installation) => this.buildInstallationSummary(installation)));
  }

  async getInstallationStatus(installationId: number): Promise<GitHubInstallationStatusDto> {
    const installation = await this.githubInstallationsRepository.findByGithubInstallationId(installationId);

    if (!installation) {
      throw new Error(`GitHub installation ${installationId} not found`);
    }

    return this.buildInstallationStatus(installation);
  }

  async syncInstallation(installationId: number): Promise<GitHubInstallationSyncDto> {
    const installation = await this.githubInstallationsRepository.findByGithubInstallationId(installationId);

    if (!installation) {
      throw new Error(`GitHub installation ${installationId} not found`);
    }

    const githubRepositories = await this.githubAppService.listInstallationRepositories(installationId);
    const now = new Date();

    for (const repository of githubRepositories) {
      await this.repositoriesRepository.upsertByGithubRepositoryId(this.mapRepositoryInput(installation, repository, now));
    }

    await this.githubInstallationsRepository.upsertByGithubInstallationId({
      provider: 'github',
      githubInstallationId: installation.githubInstallationId,
      githubAccountId: installation.githubAccountId ?? undefined,
      githubAccountLogin: installation.githubAccountLogin,
      githubAccountType: installation.githubAccountType,
      createdByUserId: installation.createdByUserId ?? undefined,
      installationTarget: installation.installationTarget ?? installation.githubAccountType,
      encryptedAccessToken: installation.encryptedAccessToken ?? undefined,
      accessTokenExpiresAt: installation.accessTokenExpiresAt ?? undefined,
      suspendedAt: null,
      metadata: {
        ...(installation.metadata ?? {}),
        lastSyncAt: now.toISOString(),
        repositoryCount: githubRepositories.length,
      },
    });

    return {
      synced: githubRepositories.length,
      installation: await this.getInstallationStatus(installationId),
    };
  }

  async connectRepository(installationId: number, githubRepositoryId: number): Promise<GitHubRepositoryConnectionDto> {
    const installation = await this.githubInstallationsRepository.findByGithubInstallationId(installationId);

    if (!installation) {
      throw new Error(`GitHub installation ${installationId} not found`);
    }

    const githubRepositories = await this.githubAppService.listInstallationRepositories(installationId);
    const repository = githubRepositories.find((entry) => entry.id === githubRepositoryId);

    if (!repository) {
      throw new Error(`GitHub repository ${githubRepositoryId} is not available on installation ${installationId}`);
    }

    const repositoryRecord = await this.repositoriesRepository.upsertByGithubRepositoryId(this.mapRepositoryInput(installation, repository, new Date()));

    return {
      installation: await this.getInstallationStatus(installationId),
      repository: this.toRepositorySummary(repositoryRecord),
    };
  }

  async applyInstallationWebhook(payload: GitHubInstallationPayload): Promise<GitHubInstallationSyncDto> {
    const installation = await this.githubInstallationsRepository.upsertByGithubInstallationId({
      provider: 'github',
      githubInstallationId: payload.installation.id,
      githubAccountId: payload.installation.account.id,
      githubAccountLogin: payload.installation.account.login,
      githubAccountType: this.normalizeAccountType(payload.installation.account.type),
      installationTarget: payload.installation.target_type ?? payload.installation.account.type,
      suspendedAt: payload.installation.suspended_at ? new Date(payload.installation.suspended_at) : null,
      metadata: {
        action: payload.action ?? null,
        repositorySelection: payload.installation.repository_selection ?? 'all',
      },
    });

    const repositoriesFromPayload = payload.repositories ?? payload.repositories_added ?? [];

    if (repositoriesFromPayload.length > 0) {
      const now = new Date();

      for (const repository of repositoriesFromPayload) {
        await this.repositoriesRepository.upsertByGithubRepositoryId(this.mapRepositoryInput(installation, repository, now));
      }
    } else {
      await this.syncInstallation(payload.installation.id);
    }

    for (const removedRepository of payload.repositories_removed ?? []) {
      await this.repositoriesRepository.disableByGithubRepositoryId(removedRepository.id, {
        installationId: payload.installation.id,
        removedAt: new Date().toISOString(),
        source: 'installation_repositories_webhook',
      });
    }

    const installationStatus = await this.getInstallationStatus(payload.installation.id);

    await this.githubInstallationsRepository.upsertByGithubInstallationId({
      provider: 'github',
      githubInstallationId: installation.githubInstallationId,
      githubAccountId: installation.githubAccountId ?? undefined,
      githubAccountLogin: installation.githubAccountLogin,
      githubAccountType: installation.githubAccountType,
      createdByUserId: installation.createdByUserId ?? undefined,
      installationTarget: installation.installationTarget ?? installation.githubAccountType,
      encryptedAccessToken: installation.encryptedAccessToken ?? undefined,
      accessTokenExpiresAt: installation.accessTokenExpiresAt ?? undefined,
      suspendedAt: installation.suspendedAt,
      metadata: {
        ...(installation.metadata ?? {}),
        lastSyncAt: new Date().toISOString(),
        repositoryCount: installationStatus.repositoryCount,
      },
    });

    return {
      synced: repositoriesFromPayload.length,
      installation: installationStatus,
    };
  }

  async applyRepositoryWebhook(payload: GitHubRepositoryWebhookPayload): Promise<GitHubRepositoryConnectionDto> {
    const installation = await this.githubInstallationsRepository.findByGithubInstallationId(payload.installation.id);

    if (!installation) {
      throw new Error(`GitHub installation ${payload.installation.id} not found`);
    }

    const repositoryRecord = await this.repositoriesRepository.upsertByGithubRepositoryId(
      this.mapRepositoryInput(installation, payload.repository, new Date()),
    );

    return {
      installation: await this.getInstallationStatus(payload.installation.id),
      repository: this.toRepositorySummary(repositoryRecord),
    };
  }

  async createReviewJobFromPullRequestWebhook(
    payload: GitHubPullRequestWebhookPayload,
  ): Promise<{ pullRequestId: string; reviewJob: GitHubReviewJobDto | null }> {
    const installation = await this.githubInstallationsRepository.findByGithubInstallationId(payload.installation.id);

    if (!installation) {
      throw new Error(`GitHub installation ${payload.installation.id} not found`);
    }

    const repository = await this.repositoriesRepository.findByGithubRepositoryId(payload.repository.id);

    if (!repository) {
      throw new Error(`GitHub repository ${payload.repository.id} not found for installation ${payload.installation.id}`);
    }

    const pullRequest = await this.pullRequestsRepository.upsertByGithubPullRequestId({
      repositoryId: repository.id,
      githubPullRequestId: payload.pull_request.id,
      number: payload.pull_request.number,
      title: payload.pull_request.title,
      body: payload.pull_request.body,
      state: payload.pull_request.state,
      reviewState: payload.pull_request.draft ? 'pending' : 'queued',
      baseRef: payload.pull_request.base.ref,
      headRef: payload.pull_request.head.ref,
      baseSha: payload.pull_request.base.sha,
      headSha: payload.pull_request.head.sha,
      mergedAt: payload.pull_request.merged_at ? new Date(payload.pull_request.merged_at) : null,
      closedAt: payload.pull_request.closed_at ? new Date(payload.pull_request.closed_at) : null,
      metadata: {
        action: payload.action ?? null,
        draft: payload.pull_request.draft ?? false,
        installationId: payload.installation.id,
      },
    });

    const reviewTriggerActions = new Set(['opened', 'reopened', 'synchronize', 'ready_for_review']);

    if (payload.pull_request.draft || payload.pull_request.state !== 'open' || !reviewTriggerActions.has(payload.action ?? 'opened')) {
      return { pullRequestId: pullRequest.id, reviewJob: null };
    }

    const existingJob = await this.reviewJobsRepository.findActiveByPullRequestId(pullRequest.id);

    if (existingJob) {
      return {
        pullRequestId: pullRequest.id,
        reviewJob: this.toReviewJobSummary(existingJob),
      };
    }

    const reviewJob = await this.reviewJobsRepository.enqueue({
      repositoryId: repository.id,
      pullRequestId: pullRequest.id,
      requestedByUserId: repository.ownerUserId ?? undefined,
      status: 'queued',
      jobType: 'pull_request_review',
      priority: 0,
      input: {
        source: 'github_webhook',
        action: payload.action ?? 'opened',
        installationId: payload.installation.id,
        githubRepositoryId: payload.repository.id,
        githubPullRequestId: payload.pull_request.id,
        headSha: payload.pull_request.head.sha,
        baseSha: payload.pull_request.base.sha,
      },
      metadata: {
        installationId: payload.installation.id,
        repositoryFullName: payload.repository.full_name,
      },
    });

    return {
      pullRequestId: pullRequest.id,
      reviewJob: this.toReviewJobSummary(reviewJob),
    };
  }

  private buildInstallationSummary(installation: GithubInstallation): Promise<GitHubInstallationSummaryDto> {
    return this.repositoriesRepository.findManyByInstallationId(installation.id).then((repositories) => ({
      id: installation.id,
      githubInstallationId: installation.githubInstallationId,
      githubAccountLogin: installation.githubAccountLogin,
      githubAccountType: installation.githubAccountType,
      installationTarget: installation.installationTarget ?? null,
      suspendedAt: installation.suspendedAt ?? null,
      repositoryCount: repositories.length,
      syncState: this.deriveInstallationState(
        installation.suspendedAt ?? null,
        repositories.map((repository) => repository.syncState),
      ),
      lastSyncAt: this.readMetadataDate(installation.metadata, 'lastSyncAt'),
    }));
  }

  private buildInstallationStatus(installation: GithubInstallation): Promise<GitHubInstallationStatusDto> {
    return this.repositoriesRepository.findManyByInstallationId(installation.id).then((repositories) => ({
      id: installation.id,
      githubInstallationId: installation.githubInstallationId,
      githubAccountLogin: installation.githubAccountLogin,
      githubAccountType: installation.githubAccountType,
      installationTarget: installation.installationTarget ?? null,
      suspendedAt: installation.suspendedAt ?? null,
      repositoryCount: repositories.length,
      syncState: this.deriveInstallationState(
        installation.suspendedAt ?? null,
        repositories.map((repository) => repository.syncState),
      ),
      lastSyncAt: this.readMetadataDate(installation.metadata, 'lastSyncAt'),
      metadata: installation.metadata ?? {},
      repositories: repositories.map((repository) => this.toRepositorySummary(repository)),
    }));
  }

  private mapRepositoryInput(
    installation: GithubInstallation,
    repository: GitHubRepositoryIdentity,
    lastSyncedAt: Date,
  ): NewRepository {
    return {
      provider: 'github' as const,
      githubRepositoryId: repository.id,
      githubInstallationId: installation.id,
      ownerLogin: this.extractOwnerLogin(repository.full_name, installation.githubAccountLogin),
      name: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch,
      visibility: this.normalizeVisibility(repository),
      syncState: repository.archived ? 'disabled' : 'ready',
      isArchived: repository.archived,
      isFork: repository.fork,
      language: repository.language,
      lastSyncedAt,
      metadata: this.buildRepositoryMetadata(installation, repository),
    };
  }

  private toRepositorySummary(repository: Repository): GitHubRepositorySummaryDto {
    return {
      id: repository.id,
      githubRepositoryId: repository.githubRepositoryId,
      githubInstallationId: repository.githubInstallationId,
      ownerLogin: repository.ownerLogin,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      visibility: repository.visibility,
      syncState: repository.syncState,
      isArchived: repository.isArchived,
      isFork: repository.isFork,
      language: repository.language ?? null,
      lastSyncedAt: repository.lastSyncedAt ?? null,
      metadata: repository.metadata ?? {},
    };
  }

  private toReviewJobSummary(reviewJob: ReviewJob): GitHubReviewJobDto {
    return {
      id: reviewJob.id,
      repositoryId: reviewJob.repositoryId,
      pullRequestId: reviewJob.pullRequestId,
      status: reviewJob.status,
      jobType: reviewJob.jobType,
      priority: reviewJob.priority,
    };
  }

  private normalizeAccountType(accountType: GitHubInstallationPayload['installation']['account']['type']): 'user' | 'organization' {
    return accountType === 'Organization' ? 'organization' : 'user';
  }

  private normalizeVisibility(repository: GitHubRepositoryIdentity): 'public' | 'private' | 'internal' {
    return repository.visibility ?? (repository.private ? 'private' : 'public');
  }

  private extractOwnerLogin(fullName: string, fallbackLogin: string): string {
    const [ownerLogin] = fullName.split('/');
    return ownerLogin ?? fallbackLogin;
  }

  private buildRepositoryMetadata(installation: GithubInstallation, repository: GitHubRepositoryIdentity): Record<string, unknown> {
    return {
      installationId: installation.githubInstallationId,
      repositorySelection: installation.metadata?.repositorySelection ?? 'all',
      repositoryFullName: repository.full_name,
      repositoryName: repository.name,
      githubRepositoryId: repository.id,
    };
  }

  private deriveInstallationState(
    suspendedAt: Date | null,
    repositoryStates: Array<'pending' | 'syncing' | 'ready' | 'error' | 'disabled'>,
  ): 'pending' | 'syncing' | 'ready' | 'error' | 'disabled' {
    if (suspendedAt) {
      return 'disabled';
    }

    if (repositoryStates.includes('error')) {
      return 'error';
    }

    if (repositoryStates.includes('pending') || repositoryStates.includes('syncing')) {
      return 'syncing';
    }

    return repositoryStates.length > 0 ? 'ready' : 'pending';
  }

  private readMetadataDate(metadata: Record<string, unknown> | null | undefined, key: string): Date | null {
    const value = metadata?.[key];

    if (typeof value !== 'string') {
      return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }
}
