import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const apiKeys = pgTable(
  'api_keys',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    createdByUserId: createForeignIdColumn('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
    keyHash: varchar('key_hash', { length: 128 }).notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdx: index('api_keys_organization_id_idx').on(table.organizationId),
    keyPrefixIdx: uniqueIndex('api_keys_key_prefix_unique_idx').on(table.keyPrefix),
    keyHashIdx: uniqueIndex('api_keys_key_hash_unique_idx').on(table.keyHash),
    revokedAtIdx: index('api_keys_revoked_at_idx').on(table.revokedAt),
  }),
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
