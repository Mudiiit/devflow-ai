import { relations } from 'drizzle-orm';
import { pullRequests } from '../schema/pull-requests.js';
import { repositories } from '../schema/repositories.js';
import { reviewJobs } from '../schema/review-jobs.js';
import { reviewMetrics } from '../schema/review-metrics.js';

export const reviewMetricsRelations = relations(reviewMetrics, ({ one }) => ({
  reviewJob: one(reviewJobs, {
    fields: [reviewMetrics.reviewJobId],
    references: [reviewJobs.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [reviewMetrics.pullRequestId],
    references: [pullRequests.id],
  }),
  repository: one(repositories, {
    fields: [reviewMetrics.repositoryId],
    references: [repositories.id],
  }),
}));
