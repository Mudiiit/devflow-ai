import { eq } from 'drizzle-orm';
import { reviewComments } from '../schema/review-comments.js';
import type { NewReviewComment } from '../schema/review-comments.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class ReviewCommentsRepository extends BaseRepository<typeof reviewComments> {
  constructor(db: DatabaseClient) {
    super(db, reviewComments, reviewComments.id);
  }

  async findByThreadId(threadId: string) {
    const rows = await this.db
      .select()
      .from(reviewComments)
      .where(eq(reviewComments.threadId, threadId))
      .limit(1);

    return rows[0] ?? null;
  }

  async findManyByReviewJobId(reviewJobId: string) {
    return this.db
      .select()
      .from(reviewComments)
      .where(eq(reviewComments.reviewJobId, reviewJobId));
  }

  async upsertByThreadId(threadId: string, input: NewReviewComment) {
    const existing = await this.findByThreadId(threadId);

    if (existing) {
      const rows = await this.db
        .update(reviewComments)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(reviewComments.id, existing.id))
        .returning();

      return rows[0] ?? existing;
    }

    const rows = await this.db.insert(reviewComments).values(input).returning();

    return rows[0]!;
  }
}