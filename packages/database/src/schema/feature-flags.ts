import { boolean, index, integer, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps } from './shared.js';
import { organizations } from './organizations.js';

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 128 }).notNull(),
    description: varchar('description', { length: 512 }),
    enabled: boolean('enabled').notNull().default(false),
    rolloutPercent: integer('rollout_percent').notNull().default(100),
    rules: createMetadataColumn<Record<string, unknown>>(),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdx: index('feature_flags_organization_id_idx').on(table.organizationId),
    keyLookupIdx: index('feature_flags_key_idx').on(table.key),
    uniqueKeyByOrgIdx: uniqueIndex('feature_flags_key_organization_unique_idx').on(table.key, table.organizationId),
  }),
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
