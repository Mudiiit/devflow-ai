import { bigint, index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import {
  createForeignIdColumn,
  createIdColumn,
  createMetadataColumn,
  createTimestamps,
  pullRequestReviewStateEnum,
  pullRequestStateEnum,
} from './shared.js';
import { repositories } from './repositories.js';

export const pullRequests = pgTable(
  'pull_requests',
  {
    id: createIdColumn(),
    repositoryId: createForeignIdColumn('repository_id').references(() => repositories.id, { onDelete: 'cascade' }).notNull(),
    githubPullRequestId: bigint('github_pull_request_id', { mode: 'number' }).notNull(),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    state: pullRequestStateEnum('state').notNull().default('open'),
    reviewState: pullRequestReviewStateEnum('review_state').notNull().default('pending'),
    baseRef: varchar('base_ref', { length: 255 }).notNull(),
    headRef: varchar('head_ref', { length: 255 }).notNull(),
    baseSha: varchar('base_sha', { length: 64 }).notNull(),
    headSha: varchar('head_sha', { length: 64 }).notNull(),
    mergedAt: timestamp('merged_at', { withTimezone: true, mode: 'date' }),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    githubPullRequestIdIdx: uniqueIndex('pull_requests_github_pull_request_id_unique_idx').on(table.githubPullRequestId),
    repositoryNumberIdx: uniqueIndex('pull_requests_repository_id_number_unique_idx').on(table.repositoryId, table.number),
    repositoryStateIdx: index('pull_requests_repository_state_idx').on(table.repositoryId, table.state),
    reviewStateIdx: index('pull_requests_review_state_idx').on(table.reviewState),
  }),
);

export type PullRequest = typeof pullRequests.$inferSelect;
export type NewPullRequest = typeof pullRequests.$inferInsert;