import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { notifications } from '../schema/notifications.js';
import type { Notification, NewNotification } from '../schema/notifications.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class NotificationsRepository extends BaseRepository<typeof notifications> {
  constructor(db: DatabaseClient) {
    super(db, notifications, notifications.id);
  }

  async findManyByUserId(
    userId: string,
    input: {
      readonly limit?: number;
      readonly unreadOnly?: boolean;
      readonly afterCreatedAt?: Date;
      readonly sort?: 'asc' | 'desc';
    } = {},
  ): Promise<Notification[]> {
    const filters = [eq(notifications.userId, userId)];

    if (input.unreadOnly === true) {
      filters.push(isNull(notifications.readAt));
    }

    if (input.afterCreatedAt !== undefined) {
      filters.push(gt(notifications.createdAt, input.afterCreatedAt));
    }

    const sortDirection = input.sort ?? 'desc';
    return this.db
      .select()
      .from(notifications)
      .where(filters.length === 1 ? filters[0] : and(...filters))
      .orderBy(
        sortDirection === 'desc' ? desc(notifications.createdAt) : asc(notifications.createdAt),
        sortDirection === 'desc' ? desc(notifications.id) : asc(notifications.id),
      )
      .limit(input.limit ?? 50);
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return Number(rows[0]?.count ?? 0);
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    const rows = await this.db
      .update(notifications)
      .set({
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    return rows[0] ?? null;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });

    return rows.length;
  }

  async createNotification(input: NewNotification): Promise<Notification> {
    return this.create(input);
  }
}