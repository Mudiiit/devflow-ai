import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { reviewJobs } from '../schema/review-jobs.js';
import type { NewReviewJob } from '../schema/review-jobs.js';
import { repositories } from '../schema/repositories.js';
import { pullRequests } from '../schema/pull-requests.js';
import { reviewMetrics } from '../schema/review-metrics.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

type ReviewJobMonitoringRow = {
  readonly id: string;
  readonly status: string;
  readonly retryCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt: Date | null;
  readonly leasedAt: Date | null;
  readonly leaseExpiresAt: Date | null;
  readonly completedAt: Date | null;
  readonly failedAt: Date | null;
  readonly errorMessage: string | null;
  readonly repositoryName: string;
  readonly pullRequestNumber: number;
  readonly pullRequestTitle: string;
  readonly executionMs: number | null;
  readonly riskScore: number | null;
  readonly confidenceScore: number | null;
  readonly overallSeverity: string | null;
};

export type ReviewJobMonitoringSnapshot = {
  readonly summary: {
    readonly queued: number;
    readonly running: number;
    readonly completed: number;
    readonly failed: number;
  };
  readonly jobs: ReviewJobMonitoringRow[];
};

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

  async findMonitoringSnapshot(organizationId: string, limit = 25): Promise<ReviewJobMonitoringSnapshot> {
    const sanitizedLimit = Math.min(Math.max(limit, 1), 100);

    const statusRows = await this.db
      .select({
        status: reviewJobs.status,
        count: sql<number>`count(*)`,
      })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .where(eq(repositories.organizationId, organizationId))
      .groupBy(reviewJobs.status);

    const jobs = (await this.db
      .select({
        id: reviewJobs.id,
        status: reviewJobs.status,
        retryCount: reviewJobs.retryCount,
        createdAt: reviewJobs.createdAt,
        updatedAt: reviewJobs.updatedAt,
        startedAt: reviewJobs.startedAt,
        leasedAt: reviewJobs.leasedAt,
        leaseExpiresAt: reviewJobs.leaseExpiresAt,
        completedAt: reviewJobs.completedAt,
        failedAt: reviewJobs.failedAt,
        errorMessage: reviewJobs.errorMessage,
        repositoryName: repositories.fullName,
        pullRequestNumber: pullRequests.number,
        pullRequestTitle: pullRequests.title,
        executionMs: reviewMetrics.executionMs,
        riskScore: reviewMetrics.riskScore,
        confidenceScore: reviewMetrics.confidenceScore,
        overallSeverity: reviewMetrics.overallSeverity,
      })
      .from(reviewJobs)
      .innerJoin(repositories, eq(reviewJobs.repositoryId, repositories.id))
      .innerJoin(pullRequests, eq(reviewJobs.pullRequestId, pullRequests.id))
      .leftJoin(reviewMetrics, eq(reviewMetrics.reviewJobId, reviewJobs.id))
      .where(eq(repositories.organizationId, organizationId))
      .orderBy(desc(reviewJobs.updatedAt))
      .limit(sanitizedLimit)) as ReviewJobMonitoringRow[];

    const countFor = (...statuses: string[]) =>
      statusRows
        .filter((row) => statuses.includes(row.status))
        .reduce((total, row) => total + Number(row.count ?? 0), 0);

    return {
      summary: {
        queued: countFor('queued'),
        running: countFor('leased', 'chunking', 'analyzing', 'summarizing', 'processing'),
        completed: countFor('completed'),
        failed: countFor('failed', 'cancelled'),
      },
      jobs,
    };
  }
}