import { relations } from 'drizzle-orm';
import { auditLogs } from '../schema/audit-logs.js';
import { githubInstallations } from '../schema/github-installations.js';
import { pullRequests } from '../schema/pull-requests.js';
import { repositories } from '../schema/repositories.js';
import { reviewJobs } from '../schema/review-jobs.js';
import { users } from '../schema/users.js';

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  installation: one(githubInstallations, {
    fields: [repositories.githubInstallationId],
    references: [githubInstallations.id],
  }),
  owner: one(users, {
    fields: [repositories.ownerUserId],
    references: [users.id],
  }),
  pullRequests: many(pullRequests),
  reviewJobs: many(reviewJobs),
  auditLogs: many(auditLogs),
}));