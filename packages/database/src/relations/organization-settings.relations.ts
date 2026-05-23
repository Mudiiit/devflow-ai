import { relations } from 'drizzle-orm';
import { organizationSettings } from '../schema/organization-settings.js';
import { organizations } from '../schema/organizations.js';

export const organizationSettingsRelations = relations(organizationSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSettings.organizationId],
    references: [organizations.id],
  }),
}));
