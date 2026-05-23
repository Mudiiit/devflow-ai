import { relations } from 'drizzle-orm';
import { auditLogs } from '../schema/audit-logs.js';
import { githubInstallations } from '../schema/github-installations.js';
import { authSessions } from '../schema/auth-sessions.js';
import { notifications } from '../schema/notifications.js';
import { repositories } from '../schema/repositories.js';
import { reviewJobs } from '../schema/review-jobs.js';
import { users } from '../schema/users.js';

export const usersRelations = relations(users, ({ many }) => ({
  authSessions: many(authSessions),
  createdGithubInstallations: many(githubInstallations),
  ownedRepositories: many(repositories),
  requestedReviewJobs: many(reviewJobs),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));