import { asc, eq } from 'drizzle-orm';
import { aiReviewChunks } from '../schema/ai-review-chunks.js';
import type { NewAiReviewChunk } from '../schema/ai-review-chunks.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class AiReviewChunksRepository extends BaseRepository<typeof aiReviewChunks> {
  constructor(db: DatabaseClient) {
    super(db, aiReviewChunks, aiReviewChunks.id);
  }

  async findByReviewJobId(reviewJobId: string) {
    return this.db
      .select()
      .from(aiReviewChunks)
      .where(eq(aiReviewChunks.reviewJobId, reviewJobId))
      .orderBy(asc(aiReviewChunks.chunkIndex));
  }

  async deleteByReviewJobId(reviewJobId: string) {
    const rows = await this.db
      .delete(aiReviewChunks)
      .where(eq(aiReviewChunks.reviewJobId, reviewJobId))
      .returning();

    return rows.length;
  }

  async upsertForReviewJob(input: NewAiReviewChunk) {
    const rows = await this.db
      .insert(aiReviewChunks)
      .values(input)
      .onConflictDoUpdate({
        target: [aiReviewChunks.reviewJobId, aiReviewChunks.chunkIndex],
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}