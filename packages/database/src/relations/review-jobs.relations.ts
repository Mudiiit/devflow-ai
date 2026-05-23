import { relations } from 'drizzle-orm';
import { aiReviewChunks } from '../schema/ai-review-chunks.js';
import { pullRequests } from '../schema/pull-requests.js';
import { repositories } from '../schema/repositories.js';
import { reviewComments } from '../schema/review-comments.js';
import { reviewJobs } from '../schema/review-jobs.js';
import { users } from '../schema/users.js';

export const reviewJobsRelations = relations(reviewJobs, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [reviewJobs.repositoryId],
    references: [repositories.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [reviewJobs.pullRequestId],
    references: [pullRequests.id],
  }),
  requestedBy: one(users, {
    fields: [reviewJobs.requestedByUserId],
    references: [users.id],
  }),
  reviewComments: many(reviewComments),
  aiReviewChunks: many(aiReviewChunks),
}));