import { eq } from 'drizzle-orm';
import { reviewMetrics } from '../schema/review-metrics.js';
import type { NewReviewMetrics } from '../schema/review-metrics.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class ReviewMetricsRepository extends BaseRepository<typeof reviewMetrics> {
  constructor(db: DatabaseClient) {
    super(db, reviewMetrics, reviewMetrics.id);
  }

  async findByReviewJobId(reviewJobId: string) {
    const rows = await this.db
      .select()
      .from(reviewMetrics)
      .where(eq(reviewMetrics.reviewJobId, reviewJobId))
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertForReviewJob(input: NewReviewMetrics) {
    const existing = await this.findByReviewJobId(input.reviewJobId);

    if (existing) {
      const rows = await this.db
        .update(reviewMetrics)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(reviewMetrics.id, existing.id))
        .returning();

      return rows[0] ?? existing;
    }

    const rows = await this.db.insert(reviewMetrics).values(input).returning();

    return rows[0]!;
  }
}
