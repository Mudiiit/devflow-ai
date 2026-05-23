import { eq } from 'drizzle-orm';
import { pullRequests } from '../schema/pull-requests.js';
import type { NewPullRequest } from '../schema/pull-requests.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class PullRequestsRepository extends BaseRepository<typeof pullRequests> {
  constructor(db: DatabaseClient) {
    super(db, pullRequests, pullRequests.id);
  }

  async findByGithubPullRequestId(githubPullRequestId: number) {
    const rows = await this.db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.githubPullRequestId, githubPullRequestId))
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertByGithubPullRequestId(input: NewPullRequest) {
    const rows = await this.db
      .insert(pullRequests)
      .values(input)
      .onConflictDoUpdate({
        target: pullRequests.githubPullRequestId,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}