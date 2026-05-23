import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createForeignIdColumn, createIdColumn, createMetadataColumn, createTimestamps, notificationDeliveryChannelEnum, notificationTypeEnum } from './shared.js';
import { users } from './users.js';

export const notifications = pgTable(
  'notifications',
  {
    id: createIdColumn(),
    userId: createForeignIdColumn('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    type: notificationTypeEnum('type').notNull(),
    deliveryChannel: notificationDeliveryChannelEnum('delivery_channel').notNull().default('in_app'),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    actionUrl: text('action_url'),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    payload: createMetadataColumn<Record<string, unknown>>(),
    metadata: createMetadataColumn<Record<string, unknown>>(),
    ...createTimestamps(),
  },
  (table) => ({
    userIdx: index('notifications_user_id_idx').on(table.userId),
    typeIdx: index('notifications_type_idx').on(table.type),
    readAtIdx: index('notifications_read_at_idx').on(table.readAt),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;