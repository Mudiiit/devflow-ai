import { relations } from 'drizzle-orm';
import { githubInstallations } from '../schema/github-installations.js';
import { organizationMemberships } from '../schema/organization-memberships.js';
import { organizationSettings } from '../schema/organization-settings.js';
import { organizations } from '../schema/organizations.js';
import { repositories } from '../schema/repositories.js';
import { repositorySettings } from '../schema/repository-settings.js';
import { users } from '../schema/users.js';

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  owner: one(users, {
    fields: [organizations.ownerUserId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [organizations.createdByUserId],
    references: [users.id],
  }),
  memberships: many(organizationMemberships),
  settings: many(organizationSettings),
  repositories: many(repositories),
  repositorySettings: many(repositorySettings),
  githubInstallations: many(githubInstallations),
}));
