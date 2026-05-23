import { relations } from 'drizzle-orm';
import { aiReviewChunks } from '../schema/ai-review-chunks.js';
import { auditLogs } from '../schema/audit-logs.js';
import { pullRequests } from '../schema/pull-requests.js';
import { repositories } from '../schema/repositories.js';
import { reviewComments } from '../schema/review-comments.js';
import { reviewJobs } from '../schema/review-jobs.js';

export const pullRequestsRelations = relations(pullRequests, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [pullRequests.repositoryId],
    references: [repositories.id],
  }),
  reviewJobs: many(reviewJobs),
  reviewComments: many(reviewComments),
  aiReviewChunks: many(aiReviewChunks),
  auditLogs: many(auditLogs),
}));