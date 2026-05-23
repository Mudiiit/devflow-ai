import { boolean, integer, jsonb, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { organizations } from './organizations.js';

export const organizationSettings = pgTable(
  'organization_settings',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    aiProvider: varchar('ai_provider', { length: 32 }),
    aiModel: varchar('ai_model', { length: 128 }),
    reviewStrictness: integer('review_strictness').notNull().default(50),
    autoReviewEnabled: boolean('auto_review_enabled').notNull().default(true),
    notificationPreferences: jsonb('notification_preferences').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    repositoryRules: jsonb('repository_rules').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    githubPreferences: jsonb('github_preferences').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    securityContacts: text('security_contacts'),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdx: uniqueIndex('organization_settings_organization_id_unique_idx').on(table.organizationId),
  }),
);

export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert;
