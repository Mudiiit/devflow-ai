import { relations } from 'drizzle-orm';
import { githubInstallations } from '../schema/github-installations.js';
import { organizations } from '../schema/organizations.js';
import { repositories } from '../schema/repositories.js';
import { users } from '../schema/users.js';

export const githubInstallationsRelations = relations(githubInstallations, ({ one, many }) => ({
  creator: one(users, {
    fields: [githubInstallations.createdByUserId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [githubInstallations.organizationId],
    references: [organizations.id],
  }),
  repositories: many(repositories),
}));