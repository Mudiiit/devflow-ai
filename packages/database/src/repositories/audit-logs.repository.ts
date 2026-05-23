import { auditLogs } from '../schema/audit-logs.js';
import type { DatabaseClient } from '../client/index.js';
import { BaseRepository } from './base.repository.js';

export class AuditLogsRepository extends BaseRepository<typeof auditLogs> {
  constructor(db: DatabaseClient) {
    super(db, auditLogs, auditLogs.id);
  }
}