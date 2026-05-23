import { eq } from 'drizzle-orm';
import { repositories } from '../schema/repositories.js';
import type { NewRepository } from '../schema/repositories.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class RepositoriesRepository extends BaseRepository<typeof repositories> {
  constructor(db: DatabaseClient) {
    super(db, repositories, repositories.id);
  }

  async findByGithubRepositoryId(githubRepositoryId: number) {
    const rows = await this.db
      .select()
      .from(repositories)
      .where(eq(repositories.githubRepositoryId, githubRepositoryId))
      .limit(1);

    return rows[0] ?? null;
  }

  async findManyByInstallationId(githubInstallationId: string) {
    return this.db
      .select()
      .from(repositories)
      .where(eq(repositories.githubInstallationId, githubInstallationId));
  }

  async upsertByGithubRepositoryId(input: NewRepository) {
    const rows = await this.db
      .insert(repositories)
      .values(input)
      .onConflictDoUpdate({
        target: repositories.githubRepositoryId,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }

  async disableByGithubRepositoryId(githubRepositoryId: number, metadata: Record<string, unknown>) {
    const rows = await this.db
      .update(repositories)
      .set({
        syncState: 'disabled',
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(repositories.githubRepositoryId, githubRepositoryId))
      .returning();

    return rows[0] ?? null;
  }
}