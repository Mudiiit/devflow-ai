import { Injectable } from '@nestjs/common';
import type { NewAuditLog } from '@devflow/database';
import { AuditLogsRepository } from '@devflow/database';
import { RequestContextService } from './request-context.service.js';

@Injectable()
export class AuditLogService {
  constructor(
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly requestContextService: RequestContextService,
  ) {}

  async record(entry: NewAuditLog): Promise<void> {
    await this.auditLogsRepository.create({
      ...this.applyContext(entry),
      metadata: entry.metadata ?? {},
      beforeState: entry.beforeState ?? undefined,
      afterState: entry.afterState ?? undefined,
    });
  }

  async recordHttpRequest(input: {
    readonly action: NewAuditLog['action'];
    readonly entityType: string;
    readonly entityId: string;
    readonly repositoryId?: string | null;
    readonly pullRequestId?: string | null;
    readonly reviewJobId?: string | null;
    readonly ipAddress?: string | null;
    readonly userAgent?: string | null;
    readonly metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.record({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      repositoryId: input.repositoryId ?? null,
      pullRequestId: input.pullRequestId ?? null,
      reviewJobId: input.reviewJobId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  }

  private applyContext(entry: NewAuditLog): NewAuditLog {
    const context = this.requestContextService.current();

    if (context === undefined) {
      return entry;
    }

    return {
      ...entry,
      requestId: entry.requestId ?? context.requestId,
      traceId: entry.traceId ?? context.traceId,
    };
  }
}