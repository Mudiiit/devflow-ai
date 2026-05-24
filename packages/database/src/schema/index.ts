export { users } from './users.js';
export type { User, NewUser } from './users.js';

export { authSessions } from './auth-sessions.js';
export type { AuthSession, NewAuthSession } from './auth-sessions.js';

export { oauthStates } from './oauth-states.js';
export type { OauthState, NewOauthState } from './oauth-states.js';

export { githubInstallations } from './github-installations.js';
export type { GithubInstallation, NewGithubInstallation } from './github-installations.js';

export { organizations } from './organizations.js';
export type { Organization, NewOrganization } from './organizations.js';

export { organizationMemberships } from './organization-memberships.js';
export type { OrganizationMembership, NewOrganizationMembership } from './organization-memberships.js';

export { organizationSettings } from './organization-settings.js';
export type { OrganizationSettings, NewOrganizationSettings } from './organization-settings.js';

export { repositorySettings } from './repository-settings.js';
export type { RepositorySettings, NewRepositorySettings } from './repository-settings.js';

export { repositories } from './repositories.js';
export type { Repository, NewRepository } from './repositories.js';

export { pullRequests } from './pull-requests.js';
export type { PullRequest, NewPullRequest } from './pull-requests.js';

export { reviewJobs } from './review-jobs.js';
export type { ReviewJob, NewReviewJob } from './review-jobs.js';

export { reviewComments } from './review-comments.js';
export type { ReviewComment, NewReviewComment } from './review-comments.js';

export { aiReviewChunks } from './ai-review-chunks.js';
export type { AiReviewChunk, NewAiReviewChunk } from './ai-review-chunks.js';

export { reviewMetrics } from './review-metrics.js';
export type { ReviewMetrics, NewReviewMetrics } from './review-metrics.js';

export { embeddings } from './embeddings.js';
export type { Embedding, NewEmbedding } from './embeddings.js';

export { notifications } from './notifications.js';
export type { Notification, NewNotification } from './notifications.js';

export { auditLogs } from './audit-logs.js';
export type { AuditLog, NewAuditLog } from './audit-logs.js';

export {
  billingCustomers,
  billingProviderEnum,
  billingCadenceEnum,
  billingSubscriptionStatusEnum,
  billingInvoiceStatusEnum,
  billingUsageResourceEnum,
  billingUsageUnitEnum,
  billingUsageSourceEnum,
  pricingPlans,
  subscriptions,
  invoices,
  usageRecords,
} from './billing.js';
export type {
  BillingCustomer,
  NewBillingCustomer,
  PricingPlan,
  NewPricingPlan,
  Subscription,
  NewSubscription,
  Invoice,
  NewInvoice,
  UsageRecord,
  NewUsageRecord,
} from './billing.js';

export * from './shared.js';

import { auditLogs } from './audit-logs.js';
import { aiReviewChunks } from './ai-review-chunks.js';
import { authSessions } from './auth-sessions.js';
import { embeddings } from './embeddings.js';
import { githubInstallations } from './github-installations.js';
import { oauthStates } from './oauth-states.js';
import { notifications } from './notifications.js';
import { organizationMemberships } from './organization-memberships.js';
import { organizationSettings } from './organization-settings.js';
import { organizations } from './organizations.js';
import { billingCustomers, invoices, pricingPlans, subscriptions, usageRecords } from './billing.js';
import { pullRequests } from './pull-requests.js';
import { repositorySettings } from './repository-settings.js';
import { repositories } from './repositories.js';
import { reviewComments } from './review-comments.js';
import { reviewJobs } from './review-jobs.js';
import { reviewMetrics } from './review-metrics.js';
import { users } from './users.js';

// Export a single schema object so Drizzle can infer the entire database shape
// from one import path in app code, migrations, and repository factories.
export const databaseSchema = {
  users,
  authSessions,
  oauthStates,
  githubInstallations,
  organizations,
  organizationMemberships,
  organizationSettings,
  repositorySettings,
  repositories,
  pullRequests,
  reviewJobs,
  reviewComments,
  aiReviewChunks,
  reviewMetrics,
  embeddings,
  notifications,
  billingCustomers,
  pricingPlans,
  subscriptions,
  invoices,
  usageRecords,
  auditLogs,
} as const;

export type DatabaseSchema = typeof databaseSchema;