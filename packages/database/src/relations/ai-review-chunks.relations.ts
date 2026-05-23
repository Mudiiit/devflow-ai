import { relations } from 'drizzle-orm';
import { aiReviewChunks } from '../schema/ai-review-chunks.js';
import { embeddings } from '../schema/embeddings.js';
import { pullRequests } from '../schema/pull-requests.js';
import { repositories } from '../schema/repositories.js';
import { reviewJobs } from '../schema/review-jobs.js';

export const aiReviewChunksRelations = relations(aiReviewChunks, ({ one, many }) => ({
  reviewJob: one(reviewJobs, {
    fields: [aiReviewChunks.reviewJobId],
    references: [reviewJobs.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [aiReviewChunks.pullRequestId],
    references: [pullRequests.id],
  }),
  repository: one(repositories, {
    fields: [aiReviewChunks.repositoryId],
    references: [repositories.id],
  }),
  embeddings: many(embeddings),
}));