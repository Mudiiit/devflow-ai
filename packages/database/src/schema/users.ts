import { bigint, index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createIdColumn, createMetadataColumn, createTimestamps, userRoleEnum, userStatusEnum } from './shared.js';

export const users = pgTable(
  'users',
  {
    id: createIdColumn(),
    email: varchar('email', { length: 320 }).notNull(),
    githubUserId: bigint('github_user_id', { mode: 'number' }).notNull(),
    githubLogin: varchar('github_login', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    timezone: varchar('timezone', { length: 64 }),
    locale: varchar('locale', { length: 32 }),
    role: userRoleEnum('role').notNull().default('member'),
    status: userStatusEnum('status').notNull().default('invited'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    githubUserIdIdx: uniqueIndex('users_github_user_id_unique_idx').on(table.githubUserId),
    githubLoginIdx: index('users_github_login_idx').on(table.githubLogin),
    roleIdx: index('users_role_idx').on(table.role),
    statusIdx: index('users_status_idx').on(table.status),
    emailIdx: uniqueIndex('users_email_unique_idx').on(table.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;