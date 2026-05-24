import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AuditLogService } from './audit-log.service.js';
import { MetricsService } from './metrics.service.js';
import { RequestContextService } from './request-context.service.js';
import { StructuredLoggerService } from './structured-logger.service.js';
import type { ObservabilityModuleOptions, ObservabilityRequestContext } from './types.js';

const normalizeHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const resolveAuditAction = (method: string, statusCode: number, path: string) => {
  if (statusCode >= 500) {
    return 'analysis' as const;
  }

  if (statusCode >= 400) {
    return 'notify' as const;
  }

  if (path.includes('/webhooks/') || path.includes('/review')) {
    return 'review' as const;
  }

  switch (method) {
    case 'POST':
      return 'create' as const;
    case 'PUT':
    case 'PATCH':
      return 'update' as const;
    case 'DELETE':
      return 'delete' as const;
    default:
      return 'sync' as const;
  }
};

const isObservabilityRoute = (path: string): boolean => {
  return path.startsWith('/health') || path.startsWith('/metrics');
};

@Injectable()
export class RequestTracingMiddleware implements NestMiddleware {
  constructor(
    private readonly options: ObservabilityModuleOptions,
    private readonly requestContextService: RequestContextService,
    private readonly logger: StructuredLoggerService,
    private readonly metricsService: MetricsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = normalizeHeaderValue(request.header('x-request-id')) ?? randomUUID();
    const traceId = normalizeHeaderValue(request.header('x-trace-id')) ?? randomUUID();
    const startedAt = Date.now();
    const path = request.originalUrl ?? request.url;
    const context: ObservabilityRequestContext = {
      requestId,
      traceId,
      serviceName: this.options.serviceName,
      source: 'http',
      path,
      method: request.method,
      startedAt,
    };

    response.setHeader('x-request-id', requestId);
    response.setHeader('x-trace-id', traceId);

    this.requestContextService.run(context, () => {
      this.logger.event('info', 'http.request.started', {
        method: request.method,
        path,
      });

      response.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        const statusCode = response.statusCode;

        this.metricsService.increment('devflow_http_requests_total', {
          method: request.method,
          status: statusCode,
          service: this.options.serviceName,
        });
        this.metricsService.observe('devflow_http_request_duration_ms', durationMs, {
          method: request.method,
          status: statusCode,
          service: this.options.serviceName,
        });
        this.logger.event('info', 'http.request.completed', {
          method: request.method,
          path,
          statusCode,
          durationMs,
        });

        if (!isObservabilityRoute(path) && (request.method !== 'GET' || statusCode >= 400)) {
          void this.auditLogService.recordHttpRequest({
            action: resolveAuditAction(request.method, statusCode, path),
            entityType: 'http_request',
            entityId: `${request.method} ${path}`,
            ipAddress: request.ip ?? request.socket.remoteAddress ?? null,
            userAgent: request.header('user-agent') ?? null,
            metadata: {
              method: request.method,
              path,
              statusCode,
              durationMs,
            },
          }).catch((error: unknown) => {
            this.logger.event('warn', 'audit.http_request_failed', {
              method: request.method,
              path,
              error: error instanceof Error ? error.message : 'Unknown audit failure',
            }, error instanceof Error ? error : undefined);
          });
        }
      });

      response.on('close', () => {
        if (!response.writableEnded) {
          const durationMs = Date.now() - startedAt;
          this.metricsService.increment('devflow_http_requests_aborted_total', {
            method: request.method,
            service: this.options.serviceName,
          });
          this.logger.event('warn', 'http.request.aborted', {
            method: request.method,
            path,
            durationMs,
          });
        }
      });

      next();
    });
  }
}