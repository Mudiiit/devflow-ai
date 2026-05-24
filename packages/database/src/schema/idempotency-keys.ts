import { index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    userId: createForeignIdColumn('user_id').references(() => users.id, { onDelete: 'set null' }),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    requestMethod: varchar('request_method', { length: 16 }).notNull(),
    requestPath: varchar('request_path', { length: 512 }).notNull(),
    requestHash: varchar('request_hash', { length: 128 }).notNull(),
    responseStatusCode: varchar('response_status_code', { length: 8 }),
    responseBody: text('response_body'),
    lockExpiresAt: timestamp('lock_expires_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    keyLookupIdx: uniqueIndex('idempotency_keys_request_unique_idx').on(table.idempotencyKey, table.requestMethod, table.requestPath),
    expiresAtIdx: index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  }),
);

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
