import { relations } from 'drizzle-orm';
import { organizationMemberships } from '../schema/organization-memberships.js';
import { organizations } from '../schema/organizations.js';
import { users } from '../schema/users.js';

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMemberships.userId],
    references: [users.id],
  }),
  invitedBy: one(users, {
    fields: [organizationMemberships.invitedByUserId],
    references: [users.id],
  }),
}));
