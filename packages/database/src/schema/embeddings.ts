import { bigint, index, integer, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, embeddingProviderEnum } from './shared.js';
import { aiReviewChunks } from './ai-review-chunks.js';

export const embeddings = pgTable(
  'embeddings',
  {
    id: createIdColumn(),
    aiReviewChunkId: createForeignIdColumn('ai_review_chunk_id').references(() => aiReviewChunks.id, { onDelete: 'cascade' }).notNull(),
    provider: embeddingProviderEnum('provider').notNull().default('openai'),
    model: varchar('model', { length: 255 }).notNull(),
    dimensions: integer('dimensions').notNull(),
    vector: text('vector').notNull(),
    checksum: varchar('checksum', { length: 128 }).notNull(),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    chunkIdx: uniqueIndex('embeddings_ai_review_chunk_id_unique_idx').on(table.aiReviewChunkId),
    providerIdx: index('embeddings_provider_idx').on(table.provider),
    checksumIdx: uniqueIndex('embeddings_checksum_unique_idx').on(table.checksum),
  }),
);

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;