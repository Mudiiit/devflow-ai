import type { DatabaseClient } from '../client/index.js';
import { oauthStates } from '../schema/oauth-states.js';
import { BaseRepository } from './base.repository.js';

export class OauthStatesRepository extends BaseRepository<typeof oauthStates> {
  constructor(db: DatabaseClient) {
    super(db, oauthStates, oauthStates.id);
  }
}