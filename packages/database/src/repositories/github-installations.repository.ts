import { githubInstallations } from '../schema/github-installations.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class GithubInstallationsRepository extends BaseRepository<typeof githubInstallations> {
  constructor(db: DatabaseClient) {
    super(db, githubInstallations, githubInstallations.id);
  }
}