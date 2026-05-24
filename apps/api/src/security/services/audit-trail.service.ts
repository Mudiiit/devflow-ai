import { Injectable } from '@nestjs/common';
import { AuditLogsRepository, type NewAuditLog } from '@devflow/database';

@Injectable()
export class AuditTrailService {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async record(input: {
    actorUserId?: string | null;
    organizationId?: string | null;
    repositoryId?: string | null;
    action: NewAuditLog['action'];
    entityType: string;
    entityId: string;
    requestId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
  }): Promise<void> {
    await this.auditLogsRepository.create({
      actorUserId: input.actorUserId ?? null,
      repositoryId: input.repositoryId ?? null,
      pullRequestId: null,
      reviewJobId: null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: input.requestId ?? null,
      traceId: null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      beforeState: input.beforeState ?? {},
      afterState: input.afterState ?? {},
      metadata: {
        ...(input.metadata ?? {}),
        organizationId: input.organizationId ?? null,
      },
      occurredAt: new Date(),
    });
  }
}
