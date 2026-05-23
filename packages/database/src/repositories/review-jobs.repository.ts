import { and, asc, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
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
          inArray(reviewJobs.status, ['queued', 'leased', 'chunking', 'analyzing', 'summarizing', 'processing']),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findByLeaseToken(leaseToken: string) {
    const rows = await this.db
      .select()
      .from(reviewJobs)
      .where(eq(reviewJobs.leaseToken, leaseToken))
      .limit(1);

    return rows[0] ?? null;
  }

  async findQueued(limit = 10) {
    return this.db
      .select()
      .from(reviewJobs)
      .where(eq(reviewJobs.status, 'queued'))
      .orderBy(desc(reviewJobs.priority), asc(reviewJobs.createdAt))
      .limit(limit);
  }

  async enqueue(input: NewReviewJob) {
    const rows = await this.db.insert(reviewJobs).values(input).returning();

    return rows[0]!;
  }

  async claimLease(reviewJobId: string, leaseToken: string, leaseDurationMs = 15 * 60 * 1000) {
    const now = new Date();
    const rows = await this.db
      .update(reviewJobs)
      .set({
        status: 'leased',
        leaseToken,
        leasedAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
        startedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(reviewJobs.id, reviewJobId),
          or(
            eq(reviewJobs.status, 'queued'),
            and(eq(reviewJobs.status, 'leased'), or(isNull(reviewJobs.leaseExpiresAt), lt(reviewJobs.leaseExpiresAt, now))),
          ),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  async updateStatus(reviewJobId: string, status: NewReviewJob['status'], patch: Partial<NewReviewJob> = {}) {
    const rows = await this.db
      .update(reviewJobs)
      .set({
        ...patch,
        status,
        updatedAt: new Date(),
      })
      .where(eq(reviewJobs.id, reviewJobId))
      .returning();

    return rows[0] ?? null;
  }
}