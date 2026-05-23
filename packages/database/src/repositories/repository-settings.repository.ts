import { eq } from 'drizzle-orm';
import { repositorySettings } from '../schema/repository-settings.js';
import type { NewRepositorySettings } from '../schema/repository-settings.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class RepositorySettingsRepository extends BaseRepository<typeof repositorySettings> {
  constructor(db: DatabaseClient) {
    super(db, repositorySettings, repositorySettings.id);
  }

  async findByRepositoryId(repositoryId: string) {
    const rows = await this.db
      .select()
      .from(repositorySettings)
      .where(eq(repositorySettings.repositoryId, repositoryId))
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertForRepository(input: NewRepositorySettings) {
    const existing = await this.findByRepositoryId(input.repositoryId);

    if (existing) {
      const rows = await this.db
        .update(repositorySettings)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(repositorySettings.id, existing.id))
        .returning();

      return rows[0] ?? existing;
    }

    const rows = await this.db.insert(repositorySettings).values(input).returning();

    return rows[0]!;
  }
}
