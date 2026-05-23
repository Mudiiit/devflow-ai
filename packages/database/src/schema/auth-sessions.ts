import { index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { users } from './users.js';

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: createIdColumn(),
    userId: createForeignIdColumn('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 }).notNull(),
    csrfTokenHash: varchar('csrf_token_hash', { length: 128 }).notNull(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    userIdIdx: index('auth_sessions_user_id_idx').on(table.userId),
    refreshTokenHashIdx: uniqueIndex('auth_sessions_refresh_token_hash_unique_idx').on(table.refreshTokenHash),
    expiresAtIdx: index('auth_sessions_expires_at_idx').on(table.expiresAt),
    revokedAtIdx: index('auth_sessions_revoked_at_idx').on(table.revokedAt),
  }),
);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;