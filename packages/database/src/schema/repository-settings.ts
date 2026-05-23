import { boolean, integer, jsonb, pgTable, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { repositories } from './repositories.js';
import { organizations } from './organizations.js';

export const repositorySettings = pgTable(
  'repository_settings',
  {
    id: createIdColumn(),
    repositoryId: createForeignIdColumn('repository_id').references(() => repositories.id, { onDelete: 'cascade' }).notNull(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    reviewStrictness: integer('review_strictness').notNull().default(50),
    autoReviewEnabled: boolean('auto_review_enabled').notNull().default(true),
    fileFilters: jsonb('file_filters').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    notificationPreferences: jsonb('notification_preferences').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    repositoryIdx: uniqueIndex('repository_settings_repository_id_unique_idx').on(table.repositoryId),
  }),
);

export type RepositorySettings = typeof repositorySettings.$inferSelect;
export type NewRepositorySettings = typeof repositorySettings.$inferInsert;
