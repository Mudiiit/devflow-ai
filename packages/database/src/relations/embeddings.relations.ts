import { relations } from 'drizzle-orm';
import { aiReviewChunks } from '../schema/ai-review-chunks.js';
import { embeddings } from '../schema/embeddings.js';

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  aiReviewChunk: one(aiReviewChunks, {
    fields: [embeddings.aiReviewChunkId],
    references: [aiReviewChunks.id],
  }),
}));