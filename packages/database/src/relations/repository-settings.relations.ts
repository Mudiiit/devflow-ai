import { relations } from 'drizzle-orm';
import { organizations } from '../schema/organizations.js';
import { repositories } from '../schema/repositories.js';
import { repositorySettings } from '../schema/repository-settings.js';

export const repositorySettingsRelations = relations(repositorySettings, ({ one }) => ({
  repository: one(repositories, {
    fields: [repositorySettings.repositoryId],
    references: [repositories.id],
  }),
  organization: one(organizations, {
    fields: [repositorySettings.organizationId],
    references: [organizations.id],
  }),
}));
