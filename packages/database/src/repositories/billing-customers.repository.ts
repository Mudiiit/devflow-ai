import { eq } from 'drizzle-orm';
import { billingCustomers } from '../schema/billing.js';
import type { NewBillingCustomer } from '../schema/billing.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class BillingCustomersRepository extends BaseRepository<typeof billingCustomers> {
  constructor(db: DatabaseClient) {
    super(db, billingCustomers, billingCustomers.id);
  }

  async findByOrganizationId(organizationId: string) {
    const rows = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, organizationId))
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertForOrganization(input: NewBillingCustomer) {
    const rows = await this.db
      .insert(billingCustomers)
      .values(input)
      .onConflictDoUpdate({
        target: billingCustomers.organizationId,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}