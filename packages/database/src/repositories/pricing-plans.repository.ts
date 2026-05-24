import { asc, eq } from 'drizzle-orm';
import { pricingPlans } from '../schema/billing.js';
import type { NewPricingPlan } from '../schema/billing.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class PricingPlansRepository extends BaseRepository<typeof pricingPlans> {
  constructor(db: DatabaseClient) {
    super(db, pricingPlans, pricingPlans.id);
  }

  async findByCode(code: string) {
    const rows = await this.db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.code, code))
      .limit(1);

    return rows[0] ?? null;
  }

  async findActivePlans() {
    return this.db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.active, true))
      .orderBy(asc(pricingPlans.sortOrder), asc(pricingPlans.monthlyPriceCents));
  }

  async upsertByCode(input: NewPricingPlan) {
    const rows = await this.db
      .insert(pricingPlans)
      .values(input)
      .onConflictDoUpdate({
        target: pricingPlans.code,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}