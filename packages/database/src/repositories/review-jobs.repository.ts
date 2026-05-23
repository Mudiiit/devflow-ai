import { and, eq, inArray } from 'drizzle-orm';
import { reviewJobs } from '../schema/review-jobs.js';
import type { NewReviewJob } from '../schema/review-jobs.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class ReviewJobsRepository extends BaseRepository<typeof reviewJobs> {
  constructor(db: DatabaseClient) {
    super(db, reviewJobs, reviewJobs.id);
  }

  async findActiveByPullRequestId(pullRequestId: string) {
    const rows = await this.db
      .select()
      .from(reviewJobs)
      .where(
        and(
          eq(reviewJobs.pullRequestId, pullRequestId),
          inArray(reviewJobs.status, ['queued', 'leased', 'processing']),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async enqueue(input: NewReviewJob) {
    const rows = await this.db.insert(reviewJobs).values(input).returning();

    return rows[0]!;
  }
}