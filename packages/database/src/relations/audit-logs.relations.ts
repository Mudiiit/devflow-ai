import { relations } from 'drizzle-orm';
import { auditLogs } from '../schema/audit-logs.js';
import { pullRequests } from '../schema/pull-requests.js';
import { repositories } from '../schema/repositories.js';
import { reviewJobs } from '../schema/review-jobs.js';
import { users } from '../schema/users.js';

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  repository: one(repositories, {
    fields: [auditLogs.repositoryId],
    references: [repositories.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [auditLogs.pullRequestId],
    references: [pullRequests.id],
  }),
  reviewJob: one(reviewJobs, {
    fields: [auditLogs.reviewJobId],
    references: [reviewJobs.id],
  }),
}));