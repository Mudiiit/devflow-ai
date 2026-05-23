import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, auditActionEnum } from './shared.js';
import { pullRequests } from './pull-requests.js';
import { repositories } from './repositories.js';
import { reviewJobs } from './review-jobs.js';
import { users } from './users.js';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: createIdColumn(),
    actorUserId: createForeignIdColumn('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    repositoryId: createForeignIdColumn('repository_id').references(() => repositories.id, { onDelete: 'set null' }),
    pullRequestId: createForeignIdColumn('pull_request_id').references(() => pullRequests.id, { onDelete: 'set null' }),
    reviewJobId: createForeignIdColumn('review_job_id').references(() => reviewJobs.id, { onDelete: 'set null' }),
    action: auditActionEnum('action').notNull(),
    entityType: varchar('entity_type', { length: 255 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }).notNull(),
    requestId: varchar('request_id', { length: 255 }),
    traceId: varchar('trace_id', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    beforeState: createMetadataColumn<Record<string, unknown>>(),
    afterState: createMetadataColumn<Record<string, unknown>>(),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    ...createTimestamps(),
  },
  (table) => ({
    actionIdx: index('audit_logs_action_idx').on(table.action),
    entityIdx: index('audit_logs_entity_type_entity_id_idx').on(table.entityType, table.entityId),
    actorIdx: index('audit_logs_actor_user_id_idx').on(table.actorUserId),
    repositoryIdx: index('audit_logs_repository_id_idx').on(table.repositoryId),
    pullRequestIdx: index('audit_logs_pull_request_id_idx').on(table.pullRequestId),
    reviewJobIdx: index('audit_logs_review_job_id_idx').on(table.reviewJobId),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;