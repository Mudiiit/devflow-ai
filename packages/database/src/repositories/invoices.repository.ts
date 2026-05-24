import { desc, eq } from 'drizzle-orm';
import { invoices } from '../schema/billing.js';
import type { NewInvoice } from '../schema/billing.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class InvoicesRepository extends BaseRepository<typeof invoices> {
  constructor(db: DatabaseClient) {
    super(db, invoices, invoices.id);
  }

  async findByOrganizationId(organizationId: string, limit = 12) {
    return this.db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId))
      .orderBy(desc(invoices.issuedAt), desc(invoices.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async upsertByProviderInvoiceId(input: NewInvoice) {
    const rows = await this.db
      .insert(invoices)
      .values(input)
      .onConflictDoUpdate({
        target: invoices.providerInvoiceId,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}