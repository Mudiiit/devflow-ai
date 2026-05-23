import { notifications } from '../schema/notifications.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class NotificationsRepository extends BaseRepository<typeof notifications> {
  constructor(db: DatabaseClient) {
    super(db, notifications, notifications.id);
  }
}