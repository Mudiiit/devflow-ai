import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { StructuredLoggerService } from '@devflow/logger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Get()
  async getInbox(
    @CurrentUser() user: { id: string },
    @Query('limit') limit: string | undefined,
  ) {
    const parsedLimit = limit === undefined ? 50 : Number(limit);
    return this.notificationsService.getInbox(
      user.id,
      Number.isFinite(parsedLimit) ? parsedLimit : 50,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Post(':notificationId/read')
  async markAsRead(
    @CurrentUser() user: { id: string },
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(user.id, notificationId);
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Sse('stream')
  streamNotifications(
    @CurrentUser() user: { id: string },
    @Headers('last-event-id') lastEventId?: string,
  ) {
    this.logger.event('info', 'notifications.stream.requested', {
      userId: user.id,
      hasLastEventId: Boolean(lastEventId),
    });

    return this.notificationsService.streamInbox(user.id, lastEventId);
  }
}
