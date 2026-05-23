import { index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, reviewJobStatusEnum, reviewJobTypeEnum } from './shared.js';
import { pullRequests } from './pull-requests.js';
import { repositories } from './repositories.js';
import { users } from './users.js';

export const reviewJobs = pgTable(
  'review_jobs',
  {
    id: createIdColumn(),
    repositoryId: createForeignIdColumn('repository_id').references(() => repositories.id, { onDelete: 'cascade' }).notNull(),
    pullRequestId: createForeignIdColumn('pull_request_id').references(() => pullRequests.id, { onDelete: 'cascade' }).notNull(),
    requestedByUserId: createForeignIdColumn('requested_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    status: reviewJobStatusEnum('status').notNull().default('queued'),
    jobType: reviewJobTypeEnum('job_type').notNull().default('pull_request_review'),
    priority: integer('priority').notNull().default(0),
    modelName: varchar('model_name', { length: 255 }),
    promptVersion: varchar('prompt_version', { length: 128 }),
    leaseToken: varchar('lease_token', { length: 255 }),
    leasedAt: timestamp('leased_at', { withTimezone: true, mode: 'date' }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'date' }),
    retryCount: integer('retry_count').notNull().default(0),
    errorMessage: text('error_message'),
    input: createMetadataColumn<Record<string, unknown>>(),
    output: createMetadataColumn<Record<string, unknown>>(),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    repositoryIdx: index('review_jobs_repository_id_idx').on(table.repositoryId),
    pullRequestIdx: index('review_jobs_pull_request_id_idx').on(table.pullRequestId),
    statusIdx: index('review_jobs_status_idx').on(table.status),
    leaseTokenIdx: uniqueIndex('review_jobs_lease_token_unique_idx').on(table.leaseToken),
  }),
);

export type ReviewJob = typeof reviewJobs.$inferSelect;
export type NewReviewJob = typeof reviewJobs.$inferInsert;