import { bigint, index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, githubAccountTypeEnum, repositoryProviderEnum } from './shared.js';
import { users } from './users.js';

export const githubInstallations = pgTable(
  'github_installations',
  {
    id: createIdColumn(),
    provider: repositoryProviderEnum('provider').notNull().default('github'),
    githubInstallationId: bigint('github_installation_id', { mode: 'number' }).notNull(),
    githubAccountId: bigint('github_account_id', { mode: 'number' }),
    githubAccountLogin: varchar('github_account_login', { length: 255 }).notNull(),
    githubAccountType: githubAccountTypeEnum('github_account_type').notNull(),
    createdByUserId: createForeignIdColumn('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    installationTarget: varchar('installation_target', { length: 255 }),
    encryptedAccessToken: text('encrypted_access_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true, mode: 'date' }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    githubInstallationIdIdx: uniqueIndex('github_installations_github_installation_id_unique_idx').on(table.githubInstallationId),
    githubAccountLoginIdx: index('github_installations_github_account_login_idx').on(table.githubAccountLogin),
    providerIdx: index('github_installations_provider_idx').on(table.provider),
    createdByUserIdIdx: index('github_installations_created_by_user_id_idx').on(table.createdByUserId),
  }),
);

export type GithubInstallation = typeof githubInstallations.$inferSelect;
export type NewGithubInstallation = typeof githubInstallations.$inferInsert;