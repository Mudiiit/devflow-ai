import { reviewJobs } from '../schema/review-jobs.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class ReviewJobsRepository extends BaseRepository<typeof reviewJobs> {
  constructor(db: DatabaseClient) {
    super(db, reviewJobs, reviewJobs.id);
  }
}