import { Inject, Injectable } from '@nestjs/common';
import { eq, githubInstallations, repositories, type DatabaseClient } from '@devflow/database';
import { GitHubAppService } from './github-app.service.js';
import { DATABASE_CLIENT } from '../../database/database.constants.js';

@Injectable()
export class RepositorySyncService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly githubAppService: GitHubAppService,
  ) {}

  async syncInstallation(installationId: number): Promise<{ synced: number }> {
    const installationRows = await this.db.select().from(githubInstallations).where(eq(githubInstallations.githubInstallationId, installationId)).limit(1);
    const installation = installationRows[0];

    if (!installation) {
      throw new Error(`GitHub installation ${installationId} not found`);
    }

    const githubRepositories = await this.githubAppService.listInstallationRepositories(installationId);

    for (const repository of githubRepositories) {
      await this.db.insert(repositories).values({
        provider: 'github',
        githubRepositoryId: repository.id,
        githubInstallationId: installation.id,
        ownerLogin: repository.full_name.split('/')[0] ?? installation.githubAccountLogin,
        name: repository.name,
        fullName: repository.full_name,
        defaultBranch: repository.default_branch,
        visibility: repository.visibility ?? (repository.private ? 'private' : 'public'),
        syncState: 'ready',
        isArchived: repository.archived,
        isFork: repository.fork,
        language: repository.language,
        lastSyncedAt: new Date(),
        metadata: { installationId, repositorySelection: installation.metadata?.repositorySelection ?? 'all' },
      }).onConflictDoUpdate({
        target: repositories.githubRepositoryId,
        set: {
          githubInstallationId: installation.id,
          ownerLogin: repository.full_name.split('/')[0] ?? installation.githubAccountLogin,
          name: repository.name,
          fullName: repository.full_name,
          defaultBranch: repository.default_branch,
          visibility: repository.visibility ?? (repository.private ? 'private' : 'public'),
          syncState: 'ready',
          isArchived: repository.archived,
          isFork: repository.fork,
          language: repository.language,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
          metadata: { installationId, repositorySelection: installation.metadata?.repositorySelection ?? 'all' },
        },
      });
    }

    await this.db.update(githubInstallations).set({
      suspendedAt: null,
      updatedAt: new Date(),
      metadata: {
        ...((installation.metadata as Record<string, unknown>) ?? {}),
        lastSyncAt: new Date().toISOString(),
        repositoryCount: githubRepositories.length,
      },
    }).where(eq(githubInstallations.id, installation.id));

    return { synced: githubRepositories.length };
  }
}