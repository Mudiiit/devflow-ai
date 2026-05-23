import { bigint, boolean, index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import {
  createForeignIdColumn,
  createIdColumn,
  createMetadataColumn,
  createTimestamps,
  repositoryProviderEnum,
  repositorySyncStateEnum,
  repositoryVisibilityEnum,
} from './shared.js';
import { githubInstallations } from './github-installations.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const repositories = pgTable(
  'repositories',
  {
    id: createIdColumn(),
    provider: repositoryProviderEnum('provider').notNull().default('github'),
    githubRepositoryId: bigint('github_repository_id', { mode: 'number' }).notNull(),
    githubInstallationId: createForeignIdColumn('github_installation_id').references(() => githubInstallations.id, { onDelete: 'cascade' }).notNull(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    ownerUserId: createForeignIdColumn('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    ownerLogin: varchar('owner_login', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 512 }).notNull(),
    defaultBranch: varchar('default_branch', { length: 255 }).notNull().default('main'),
    visibility: repositoryVisibilityEnum('visibility').notNull().default('private'),
    syncState: repositorySyncStateEnum('sync_state').notNull().default('pending'),
    isArchived: boolean('is_archived').notNull().default(false),
    isFork: boolean('is_fork').notNull().default(false),
    language: varchar('language', { length: 128 }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    githubRepositoryIdIdx: uniqueIndex('repositories_github_repository_id_unique_idx').on(table.githubRepositoryId),
    fullNameIdx: uniqueIndex('repositories_full_name_unique_idx').on(table.fullName),
    installationIdx: index('repositories_github_installation_id_idx').on(table.githubInstallationId),
    organizationIdx: index('repositories_organization_id_idx').on(table.organizationId),
    ownerUserIdIdx: index('repositories_owner_user_id_idx').on(table.ownerUserId),
    syncStateIdx: index('repositories_sync_state_idx').on(table.syncState),
  }),
);

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;