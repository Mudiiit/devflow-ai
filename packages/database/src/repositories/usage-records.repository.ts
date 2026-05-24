import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { usageRecords } from '../schema/billing.js';
import type { NewUsageRecord } from '../schema/billing.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class UsageRecordsRepository extends BaseRepository<typeof usageRecords> {
  constructor(db: DatabaseClient) {
    super(db, usageRecords, usageRecords.id);
  }

  async recordUsage(input: NewUsageRecord) {
    const rows = await this.db.insert(usageRecords).values(input).returning();

    return rows[0]!;
  }

  async listUsageByOrganization(organizationId: string, since?: Date) {
    const conditions = [eq(usageRecords.organizationId, organizationId)];

    if (since) {
      conditions.push(gte(usageRecords.recordedAt, since));
    }

    return this.db
      .select({
        resource: usageRecords.resource,
        quantity: sql<number>`coalesce(sum(${usageRecords.quantity}), 0)`,
      })
      .from(usageRecords)
      .where(and(...conditions))
      .groupBy(usageRecords.resource)
      .orderBy(asc(usageRecords.resource));
  }

  async listRecentUsage(organizationId: string, limit = 50) {
    return this.db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.organizationId, organizationId))
      .orderBy(desc(usageRecords.recordedAt), desc(usageRecords.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));
  }
}