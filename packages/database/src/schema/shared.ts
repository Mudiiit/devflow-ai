import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const repositoryProviderEnum = pgEnum('repository_provider', ['github']);
export const authProviderEnum = pgEnum('auth_provider', ['github']);
export const githubAccountTypeEnum = pgEnum('github_account_type', ['user', 'organization']);
export const repositoryVisibilityEnum = pgEnum('repository_visibility', ['public', 'private', 'internal']);
export const repositorySyncStateEnum = pgEnum('repository_sync_state', ['pending', 'syncing', 'ready', 'error', 'disabled']);
export const pullRequestStateEnum = pgEnum('pull_request_state', ['open', 'closed', 'merged', 'draft']);
export const pullRequestReviewStateEnum = pgEnum('pull_request_review_state', [
  'pending',
  'queued',
  'in_progress',
  'approved',
  'changes_requested',
  'commented',
  'failed',
]);
export const reviewJobStatusEnum = pgEnum('review_job_status', ['queued', 'leased', 'processing', 'completed', 'failed', 'cancelled']);
export const reviewJobTypeEnum = pgEnum('review_job_type', ['pull_request_review', 'comment_followup', 'retriage', 'embedding_refresh']);
export const reviewCommentSourceEnum = pgEnum('review_comment_source', ['ai', 'human', 'system']);
export const reviewCommentVisibilityEnum = pgEnum('review_comment_visibility', ['public', 'internal', 'draft']);
export const aiReviewChunkTypeEnum = pgEnum('ai_review_chunk_type', ['diff', 'file', 'comment', 'context', 'summary']);
export const embeddingProviderEnum = pgEnum('embedding_provider', ['openai', 'gemini', 'voyage', 'local']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'review_completed',
  'review_failed',
  'comment_mentioned',
  'job_assigned',
  'repository_synced',
]);
export const notificationDeliveryChannelEnum = pgEnum('notification_delivery_channel', ['in_app', 'email', 'slack']);
export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete', 'sync', 'review', 'analysis', 'notify']);
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'reviewer', 'member']);
export const userStatusEnum = pgEnum('user_status', ['invited', 'active', 'disabled']);

export function createIdColumn(name = 'id') {
  return uuid(name).defaultRandom().primaryKey();
}

export function createForeignIdColumn(name: string) {
  return uuid(name);
}

export function createTimestamps() {
  return {
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  } as const;
}

export function createMetadataColumn<TValue extends Record<string, unknown> = Record<string, unknown>>() {
  return jsonb('metadata').$type<TValue>().notNull().default(sql`'{}'::jsonb`);
}

export function createNullableMetadataColumn<TValue extends Record<string, unknown> = Record<string, unknown>>() {
  return jsonb('metadata').$type<TValue | null>().notNull().default(sql`'{}'::jsonb`);
}

export const genericText = text;
export const genericVarchar = varchar;
export const genericBoolean = boolean;
export const genericInteger = integer;