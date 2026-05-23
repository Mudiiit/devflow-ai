import { pullRequests } from '../schema/pull-requests.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class PullRequestsRepository extends BaseRepository<typeof pullRequests> {
  constructor(db: DatabaseClient) {
    super(db, pullRequests, pullRequests.id);
  }
}