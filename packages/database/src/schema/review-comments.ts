import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, reviewCommentSourceEnum, reviewCommentVisibilityEnum } from './shared.js';
import { pullRequests } from './pull-requests.js';
import { repositories } from './repositories.js';
import { reviewJobs } from './review-jobs.js';
import { users } from './users.js';

export const reviewComments = pgTable(
  'review_comments',
  {
    id: createIdColumn(),
    reviewJobId: createForeignIdColumn('review_job_id').references(() => reviewJobs.id, { onDelete: 'cascade' }).notNull(),
    pullRequestId: createForeignIdColumn('pull_request_id').references(() => pullRequests.id, { onDelete: 'cascade' }).notNull(),
    repositoryId: createForeignIdColumn('repository_id').references(() => repositories.id, { onDelete: 'cascade' }).notNull(),
    authorUserId: createForeignIdColumn('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    source: reviewCommentSourceEnum('source').notNull().default('ai'),
    visibility: reviewCommentVisibilityEnum('visibility').notNull().default('public'),
    githubCommentId: bigint('github_comment_id', { mode: 'number' }),
    threadId: varchar('thread_id', { length: 255 }),
    path: text('path'),
    lineNumber: integer('line_number'),
    side: varchar('side', { length: 16 }),
    isResolved: boolean('is_resolved').notNull().default(false),
    body: text('body').notNull(),
    bodyMarkdown: text('body_markdown'),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    reviewJobIdx: index('review_comments_review_job_id_idx').on(table.reviewJobId),
    pullRequestIdx: index('review_comments_pull_request_id_idx').on(table.pullRequestId),
    repositoryIdx: index('review_comments_repository_id_idx').on(table.repositoryId),
    authorUserIdx: index('review_comments_author_user_id_idx').on(table.authorUserId),
    githubCommentIdIdx: uniqueIndex('review_comments_github_comment_id_unique_idx').on(table.githubCommentId),
  }),
);

export type ReviewComment = typeof reviewComments.$inferSelect;
export type NewReviewComment = typeof reviewComments.$inferInsert;