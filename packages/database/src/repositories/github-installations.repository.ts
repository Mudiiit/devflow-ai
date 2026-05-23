import { eq } from 'drizzle-orm';
import { githubInstallations } from '../schema/github-installations.js';
import type { NewGithubInstallation } from '../schema/github-installations.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class GithubInstallationsRepository extends BaseRepository<typeof githubInstallations> {
  constructor(db: DatabaseClient) {
    super(db, githubInstallations, githubInstallations.id);
  }

  async findByGithubInstallationId(githubInstallationId: number) {
    const rows = await this.db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.githubInstallationId, githubInstallationId))
      .limit(1);

    return rows[0] ?? null;
  }

  async findManyByCreatedByUserId(createdByUserId: string) {
    return this.db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.createdByUserId, createdByUserId));
  }

  async findAll() {
    return this.db.select().from(githubInstallations);
  }

  async upsertByGithubInstallationId(input: NewGithubInstallation) {
    const rows = await this.db
      .insert(githubInstallations)
      .values(input)
      .onConflictDoUpdate({
        target: githubInstallations.githubInstallationId,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}