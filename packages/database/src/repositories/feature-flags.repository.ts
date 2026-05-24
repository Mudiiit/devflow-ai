import { and, eq, isNull } from 'drizzle-orm';
import { featureFlags } from '../schema/feature-flags.js';
import type { DatabaseClient } from '../client/index.js';
import type { NewFeatureFlag } from '../schema/feature-flags.js';
import { BaseRepository } from './base.repository.js';

export class FeatureFlagsRepository extends BaseRepository<typeof featureFlags> {
  constructor(db: DatabaseClient) {
    super(db, featureFlags, featureFlags.id);
  }

  async findByKey(key: string, organizationId?: string | null) {
    const whereClause = organizationId
      ? and(eq(featureFlags.key, key), eq(featureFlags.organizationId, organizationId))
      : and(eq(featureFlags.key, key), isNull(featureFlags.organizationId));

    const rows = await this.db.select().from(featureFlags).where(whereClause).limit(1);
    return rows[0] ?? null;
  }

  async upsertFlag(input: NewFeatureFlag) {
    const rows = await this.db
      .insert(featureFlags)
      .values(input)
      .onConflictDoUpdate({
        target: [featureFlags.key, featureFlags.organizationId],
        set: {
          description: input.description,
          enabled: input.enabled,
          rolloutPercent: input.rolloutPercent,
          rules: input.rules,
          metadata: input.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}
