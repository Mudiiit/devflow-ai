import { index, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { pullRequests } from './pull-requests.js';
import { repositories } from './repositories.js';
import { reviewJobs } from './review-jobs.js';

export const reviewMetrics = pgTable(
  'review_metrics',
  {
    id: createIdColumn(),
    reviewJobId: createForeignIdColumn('review_job_id').references(() => reviewJobs.id, { onDelete: 'cascade' }).notNull(),
    pullRequestId: createForeignIdColumn('pull_request_id').references(() => pullRequests.id, { onDelete: 'cascade' }).notNull(),
    repositoryId: createForeignIdColumn('repository_id').references(() => repositories.id, { onDelete: 'cascade' }).notNull(),
    overallSeverity: varchar('overall_severity', { length: 16 }).notNull(),
    riskScore: integer('risk_score').notNull().default(0),
    confidenceScore: integer('confidence_score').notNull().default(0),
    findingCount: integer('finding_count').notNull().default(0),
    suppressedCount: integer('suppressed_count').notNull().default(0),
    chunkCount: integer('chunk_count').notNull().default(0),
    focusAreaCount: integer('focus_area_count').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    executionMs: integer('execution_ms').notNull().default(0),
    provider: varchar('provider', { length: 32 }),
    model: varchar('model', { length: 128 }),
    summary: text('summary'),
    severityCounts: jsonb('severity_counts').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    categoryCounts: jsonb('category_counts').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    ...createTimestamps(),
  },
  (table) => ({
    reviewJobIdx: index('review_metrics_review_job_id_idx').on(table.reviewJobId),
    pullRequestIdx: index('review_metrics_pull_request_id_idx').on(table.pullRequestId),
    repositoryIdx: index('review_metrics_repository_id_idx').on(table.repositoryId),
    severityIdx: index('review_metrics_overall_severity_idx').on(table.overallSeverity),
  }),
);

export type ReviewMetrics = typeof reviewMetrics.$inferSelect;
export type NewReviewMetrics = typeof reviewMetrics.$inferInsert;
