import { eq } from 'drizzle-orm';
import { subscriptions } from '../schema/billing.js';
import type { NewSubscription } from '../schema/billing.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class SubscriptionsRepository extends BaseRepository<typeof subscriptions> {
  constructor(db: DatabaseClient) {
    super(db, subscriptions, subscriptions.id);
  }

  async findByOrganizationId(organizationId: string) {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertCurrent(input: NewSubscription) {
    const rows = await this.db
      .insert(subscriptions)
      .values(input)
      .onConflictDoUpdate({
        target: subscriptions.organizationId,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}