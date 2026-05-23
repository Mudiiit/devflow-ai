import { relations } from 'drizzle-orm';
import { pullRequests } from '../schema/pull-requests.js';
import { repositories } from '../schema/repositories.js';
import { reviewComments } from '../schema/review-comments.js';
import { reviewJobs } from '../schema/review-jobs.js';
import { users } from '../schema/users.js';

export const reviewCommentsRelations = relations(reviewComments, ({ one }) => ({
  reviewJob: one(reviewJobs, {
    fields: [reviewComments.reviewJobId],
    references: [reviewJobs.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [reviewComments.pullRequestId],
    references: [pullRequests.id],
  }),
  repository: one(repositories, {
    fields: [reviewComments.repositoryId],
    references: [repositories.id],
  }),
  author: one(users, {
    fields: [reviewComments.authorUserId],
    references: [users.id],
  }),
}));