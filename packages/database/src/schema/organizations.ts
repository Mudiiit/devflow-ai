import { index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, organizationPlanEnum, organizationStatusEnum } from './shared.js';
import { users } from './users.js';

export const organizations = pgTable(
  'organizations',
  {
    id: createIdColumn(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    billingEmail: varchar('billing_email', { length: 320 }),
    status: organizationStatusEnum('status').notNull().default('active'),
    plan: organizationPlanEnum('plan').notNull().default('free'),
    ownerUserId: createForeignIdColumn('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdByUserId: createForeignIdColumn('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    logoUrl: text('logo_url'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    slugIdx: uniqueIndex('organizations_slug_unique_idx').on(table.slug),
    ownerIdx: index('organizations_owner_user_id_idx').on(table.ownerUserId),
    planIdx: index('organizations_plan_idx').on(table.plan),
    statusIdx: index('organizations_status_idx').on(table.status),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
