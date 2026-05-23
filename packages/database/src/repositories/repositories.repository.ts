import { repositories } from '../schema/repositories.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class RepositoriesRepository extends BaseRepository<typeof repositories> {
  constructor(db: DatabaseClient) {
    super(db, repositories, repositories.id);
  }
}