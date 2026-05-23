import { relations } from 'drizzle-orm';
import { auditLogs } from '../schema/audit-logs.js';
import { githubInstallations } from '../schema/github-installations.js';
import { pullRequests } from '../schema/pull-requests.js';
import { organizations } from '../schema/organizations.js';
import { repositories } from '../schema/repositories.js';
import { repositorySettings } from '../schema/repository-settings.js';
import { reviewJobs } from '../schema/review-jobs.js';
import { users } from '../schema/users.js';

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  installation: one(githubInstallations, {
    fields: [repositories.githubInstallationId],
    references: [githubInstallations.id],
  }),
  organization: one(organizations, {
    fields: [repositories.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [repositories.ownerUserId],
    references: [users.id],
  }),
  pullRequests: many(pullRequests),
  reviewJobs: many(reviewJobs),
  settings: many(repositorySettings),
  auditLogs: many(auditLogs),
}));