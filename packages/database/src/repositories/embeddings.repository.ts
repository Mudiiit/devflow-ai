import { embeddings } from '../schema/embeddings.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class EmbeddingsRepository extends BaseRepository<typeof embeddings> {
  constructor(db: DatabaseClient) {
    super(db, embeddings, embeddings.id);
  }
}