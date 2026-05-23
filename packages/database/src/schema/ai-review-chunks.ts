import { index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, aiReviewChunkTypeEnum } from './shared.js';
import { pullRequests } from './pull-requests.js';
import { repositories } from './repositories.js';
import { reviewJobs } from './review-jobs.js';

export const aiReviewChunks = pgTable(
  'ai_review_chunks',
  {
    id: createIdColumn(),
    reviewJobId: createForeignIdColumn('review_job_id').references(() => reviewJobs.id, { onDelete: 'cascade' }).notNull(),
    pullRequestId: createForeignIdColumn('pull_request_id').references(() => pullRequests.id, { onDelete: 'cascade' }).notNull(),
    repositoryId: createForeignIdColumn('repository_id').references(() => repositories.id, { onDelete: 'cascade' }).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    chunkType: aiReviewChunkTypeEnum('chunk_type').notNull().default('diff'),
    sourcePath: text('source_path'),
    lineStart: integer('line_start'),
    lineEnd: integer('line_end'),
    tokenCount: integer('token_count').notNull().default(0),
    content: text('content').notNull(),
    summary: text('summary'),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    reviewJobChunkIdx: uniqueIndex('ai_review_chunks_review_job_id_chunk_index_unique_idx').on(table.reviewJobId, table.chunkIndex),
    repositoryIdx: index('ai_review_chunks_repository_id_idx').on(table.repositoryId),
    pullRequestIdx: index('ai_review_chunks_pull_request_id_idx').on(table.pullRequestId),
    chunkTypeIdx: index('ai_review_chunks_chunk_type_idx').on(table.chunkType),
  }),
);

export type AiReviewChunk = typeof aiReviewChunks.$inferSelect;
export type NewAiReviewChunk = typeof aiReviewChunks.$inferInsert;