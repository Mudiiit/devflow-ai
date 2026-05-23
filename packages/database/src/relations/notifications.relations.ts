import { relations } from 'drizzle-orm';
import { notifications } from '../schema/notifications.js';
import { users } from '../schema/users.js';

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));