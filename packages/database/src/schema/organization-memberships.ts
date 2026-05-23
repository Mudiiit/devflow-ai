import { index, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, organizationMemberStatusEnum, userRoleEnum } from './shared.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: createIdColumn(),
    organizationId: createForeignIdColumn('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    userId: createForeignIdColumn('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    role: userRoleEnum('role').notNull().default('member'),
    status: organizationMemberStatusEnum('status').notNull().default('active'),
    invitedByUserId: createForeignIdColumn('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    organizationIdIdx: index('organization_memberships_organization_id_idx').on(table.organizationId),
    userIdIdx: index('organization_memberships_user_id_idx').on(table.userId),
    statusIdx: index('organization_memberships_status_idx').on(table.status),
    roleIdx: index('organization_memberships_role_idx').on(table.role),
    organizationUserIdx: uniqueIndex('organization_memberships_organization_user_unique_idx').on(table.organizationId, table.userId),
  }),
);

export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembership = typeof organizationMemberships.$inferInsert;
