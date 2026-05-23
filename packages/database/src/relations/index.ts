export { usersRelations } from './users.relations.js';
export { githubInstallationsRelations } from './github-installations.relations.js';
export { organizationsRelations } from './organizations.relations.js';
export { organizationMembershipsRelations } from './organization-memberships.relations.js';
export { organizationSettingsRelations } from './organization-settings.relations.js';
export { repositoriesRelations } from './repositories.relations.js';
export { repositorySettingsRelations } from './repository-settings.relations.js';
export { pullRequestsRelations } from './pull-requests.relations.js';
export { reviewJobsRelations } from './review-jobs.relations.js';
export { reviewCommentsRelations } from './review-comments.relations.js';
export { aiReviewChunksRelations } from './ai-review-chunks.relations.js';
export { reviewMetricsRelations } from './review-metrics.relations.js';
export { embeddingsRelations } from './embeddings.relations.js';
export { notificationsRelations } from './notifications.relations.js';
export { auditLogsRelations } from './audit-logs.relations.js';

import { auditLogsRelations } from './audit-logs.relations.js';
import { aiReviewChunksRelations } from './ai-review-chunks.relations.js';
import { embeddingsRelations } from './embeddings.relations.js';
import { githubInstallationsRelations } from './github-installations.relations.js';
import { organizationMembershipsRelations } from './organization-memberships.relations.js';
import { organizationSettingsRelations } from './organization-settings.relations.js';
import { organizationsRelations } from './organizations.relations.js';
import { notificationsRelations } from './notifications.relations.js';
import { pullRequestsRelations } from './pull-requests.relations.js';
import { repositorySettingsRelations } from './repository-settings.relations.js';
import { repositoriesRelations } from './repositories.relations.js';
import { reviewCommentsRelations } from './review-comments.relations.js';
import { reviewJobsRelations } from './review-jobs.relations.js';
import { reviewMetricsRelations } from './review-metrics.relations.js';
import { usersRelations } from './users.relations.js';

export const databaseRelations = {
  usersRelations,
  githubInstallationsRelations,
  organizationsRelations,
  organizationMembershipsRelations,
  organizationSettingsRelations,
  repositoriesRelations,
  repositorySettingsRelations,
  pullRequestsRelations,
  reviewJobsRelations,
  reviewCommentsRelations,
  aiReviewChunksRelations,
  reviewMetricsRelations,
  embeddingsRelations,
  notificationsRelations,
  auditLogsRelations,
} as const;