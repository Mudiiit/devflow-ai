import { Injectable, type MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsRepository, type Notification } from '@devflow/database';
import { StructuredLoggerService } from '@devflow/logger';

type NotificationSummary = Notification & {
  readonly unread: boolean;
};

type InboxResult = {
  readonly notifications: NotificationSummary[];
  readonly unreadCount: number;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly logger: StructuredLoggerService,
  ) {}

  async getInbox(userId: string, limit = 50): Promise<InboxResult> {
    const notifications = await this.notificationsRepository.findManyByUserId(
      userId,
      {
        limit: Math.min(Math.max(limit, 1), 100),
        sort: 'desc',
      },
    );
    const unreadCount =
      await this.notificationsRepository.countUnreadByUserId(userId);

    return {
      notifications: notifications.map((notification) => ({
        ...notification,
        unread: notification.readAt === null,
      })),
      unreadCount,
    };
  }

  async getUnreadCount(
    userId: string,
  ): Promise<{ readonly unreadCount: number }> {
    return {
      unreadCount:
        await this.notificationsRepository.countUnreadByUserId(userId),
    };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationSummary | null> {
    const notification = await this.notificationsRepository.markAsRead(
      notificationId,
      userId,
    );
    if (!notification) {
      return null;
    }

    return {
      ...notification,
      unread: notification.readAt === null,
    };
  }

  async markAllAsRead(userId: string): Promise<{ readonly updated: number }> {
    const updated = await this.notificationsRepository.markAllAsRead(userId);
    return { updated };
  }

  streamInbox(userId: string, lastEventId?: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      let cursor: Date | null = null;
      let pollTimer: NodeJS.Timeout | null = null;

      this.logger.event('info', 'notifications.stream.started', {
        userId,
        hasLastEventId: Boolean(lastEventId),
      });

      const emitNotification = (notification: Notification): void => {
        subscriber.next({
          id: notification.id,
          type: notification.type,
          data: {
            ...notification,
            unread: notification.readAt === null,
          },
        });
      };

      const initialize = async (): Promise<void> => {
        try {
          if (lastEventId) {
            const lastEvent =
              await this.notificationsRepository.findById(lastEventId);
            cursor = lastEvent?.createdAt ?? null;

            const missed = await this.notificationsRepository.findManyByUserId(
              userId,
              {
                afterCreatedAt: cursor ?? undefined,
                sort: 'asc',
                limit: 100,
              },
            );

            for (const notification of missed) {
              if (closed) {
                return;
              }

              emitNotification(notification);
              cursor = notification.createdAt;
            }
          } else {
            const initial = await this.notificationsRepository.findManyByUserId(
              userId,
              {
                limit: 25,
                sort: 'desc',
              },
            );

            for (const notification of initial) {
              if (closed) {
                return;
              }

              emitNotification(notification);
            }

            cursor = initial[0]?.createdAt ?? null;
          }

          pollTimer = setInterval(() => {
            void this.pollNotifications(userId, cursor, subscriber)
              .then((nextCursor) => {
                cursor = nextCursor;
              })
              .catch((error: unknown) => {
                this.logger.event(
                  'error',
                  'notifications.stream.poll_failed',
                  { userId, cursor: cursor?.toISOString() ?? null },
                  error instanceof Error ? error : undefined,
                );

                if (!closed) {
                  subscriber.error(
                    error instanceof Error
                      ? error
                      : new Error('Notification stream failed'),
                  );
                }
              });
          }, 5_000);
        } catch (error: unknown) {
          this.logger.event(
            'error',
            'notifications.stream.initialization_failed',
            { userId, hasLastEventId: Boolean(lastEventId) },
            error instanceof Error ? error : undefined,
          );

          subscriber.error(
            error instanceof Error
              ? error
              : new Error('Notification stream failed'),
          );
        }
      };

      void initialize();

      return () => {
        closed = true;
        if (pollTimer !== null) {
          clearInterval(pollTimer);
        }
        this.logger.event('info', 'notifications.stream.closed', { userId });
      };
    });
  }

  private async pollNotifications(
    userId: string,
    cursor: Date | null,
    subscriber: { next(value: MessageEvent): void },
  ): Promise<Date | null> {
    const notifications = await this.notificationsRepository.findManyByUserId(
      userId,
      {
        afterCreatedAt: cursor ?? undefined,
        sort: 'asc',
        limit: 100,
      },
    );

    let nextCursor = cursor;
    for (const notification of notifications) {
      subscriber.next({
        id: notification.id,
        type: notification.type,
        data: {
          ...notification,
          unread: notification.readAt === null,
        },
      });
      nextCursor = notification.createdAt;
    }

    return nextCursor;
  }
}
