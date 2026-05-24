import { index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { organizations } from './organizations.js';
import { repositories } from './repositories.js';
import { users } from './users.js';

export const encryptedSecrets = pgTable(
  'encrypted_secrets',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    repositoryId: createForeignIdColumn('repository_id').references(() => repositories.id, { onDelete: 'cascade' }),
    createdByUserId: createForeignIdColumn('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    key: varchar('key', { length: 255 }).notNull(),
    algorithm: varchar('algorithm', { length: 64 }).notNull().default('aes-256-gcm'),
    encryptedValue: text('encrypted_value').notNull(),
    iv: varchar('iv', { length: 64 }).notNull(),
    authTag: varchar('auth_tag', { length: 64 }).notNull(),
    version: varchar('version', { length: 64 }).notNull().default('v1'),
    rotatedAt: timestamp('rotated_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdx: index('encrypted_secrets_organization_id_idx').on(table.organizationId),
    repositoryIdx: index('encrypted_secrets_repository_id_idx').on(table.repositoryId),
    keyLookupIdx: uniqueIndex('encrypted_secrets_scope_key_unique_idx').on(table.organizationId, table.repositoryId, table.key),
  }),
);

export type EncryptedSecret = typeof encryptedSecrets.$inferSelect;
export type NewEncryptedSecret = typeof encryptedSecrets.$inferInsert;
