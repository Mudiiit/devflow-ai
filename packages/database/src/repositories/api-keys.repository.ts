import { and, eq, isNull } from 'drizzle-orm';
import { apiKeys } from '../schema/api-keys.js';
import type { DatabaseClient } from '../client/index.js';
import type { NewApiKey } from '../schema/api-keys.js';
import { BaseRepository } from './base.repository.js';

export class ApiKeysRepository extends BaseRepository<typeof apiKeys> {
  constructor(db: DatabaseClient) {
    super(db, apiKeys, apiKeys.id);
  }

  async findManyByOrganizationId(organizationId: string) {
    return this.db.select().from(apiKeys).where(eq(apiKeys.organizationId, organizationId));
  }

  async findActiveByPrefix(keyPrefix: string) {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyPrefix, keyPrefix), isNull(apiKeys.revokedAt)))
      .limit(1);

    const row = rows[0] ?? null;
    if (!row) {
      return null;
    }

    if (row.expiresAt && row.expiresAt <= new Date()) {
      return null;
    }

    return row;
  }

  async createKey(input: NewApiKey) {
    const rows = await this.db.insert(apiKeys).values(input).returning();
    return rows[0]!;
  }

  async markUsed(id: string): Promise<void> {
    await this.db.update(apiKeys).set({ lastUsedAt: new Date(), updatedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async revoke(id: string) {
    const rows = await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();

    return rows[0] ?? null;
  }
}
