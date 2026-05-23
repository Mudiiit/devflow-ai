import { aiReviewChunks } from '../schema/ai-review-chunks.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class AiReviewChunksRepository extends BaseRepository<typeof aiReviewChunks> {
  constructor(db: DatabaseClient) {
    super(db, aiReviewChunks, aiReviewChunks.id);
  }
}