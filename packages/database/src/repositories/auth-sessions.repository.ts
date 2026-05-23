import type { DatabaseClient } from '../client/index.js';
import { authSessions } from '../schema/auth-sessions.js';
import { BaseRepository } from './base.repository.js';

export class AuthSessionsRepository extends BaseRepository<typeof authSessions> {
  constructor(db: DatabaseClient) {
    super(db, authSessions, authSessions.id);
  }
}