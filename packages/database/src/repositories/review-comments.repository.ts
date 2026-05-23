import { reviewComments } from '../schema/review-comments.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class ReviewCommentsRepository extends BaseRepository<typeof reviewComments> {
  constructor(db: DatabaseClient) {
    super(db, reviewComments, reviewComments.id);
  }
}