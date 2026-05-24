import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { context as otelContext, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';
import { createTraceCarrier, extractTraceContext, getCurrentTraceSnapshot, startSpan } from '@devflow/tracing';
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
    const startedAt = Date.now();
    const path = request.originalUrl ?? request.url;
    const incomingTraceCarrier: Record<string, string> = {};
    const traceparent = normalizeHeaderValue(request.header('traceparent'));
    const tracestate = normalizeHeaderValue(request.header('tracestate'));
    const baggage = normalizeHeaderValue(request.header('baggage'));

    if (traceparent !== undefined) {
      incomingTraceCarrier.traceparent = traceparent;
    }

    if (tracestate !== undefined) {
      incomingTraceCarrier.tracestate = tracestate;
    }

    if (baggage !== undefined) {
      incomingTraceCarrier.baggage = baggage;
    }

    const incomingTraceContext = extractTraceContext(incomingTraceCarrier);
    const spanHandle = startSpan('http.request', {
      kind: SpanKind.SERVER,
      parentContext: incomingTraceContext,
      attributes: {
        'http.method': request.method,
        'http.target': path,
        'service.name': this.options.serviceName,
        'request.id': requestId,
      },
    });
    const traceSnapshot = getCurrentTraceSnapshot(spanHandle.context);
    const context: ObservabilityRequestContext = {
      requestId,
      traceId: traceSnapshot.traceId ?? requestId,
      traceContext: createTraceCarrier(spanHandle.context),
      serviceName: this.options.serviceName,
      source: 'http',
      path,
      method: request.method,
      startedAt,
      ...(traceSnapshot.spanId === undefined ? {} : { spanId: traceSnapshot.spanId }),
    };

    response.setHeader('x-request-id', requestId);
    if (traceSnapshot.traceId !== undefined) {
      response.setHeader('x-trace-id', traceSnapshot.traceId);
    }
    if (traceSnapshot.traceparent !== undefined) {
      response.setHeader('traceparent', traceSnapshot.traceparent);
    }
    if (traceSnapshot.tracestate !== undefined) {
      response.setHeader('tracestate', traceSnapshot.tracestate);
    }

    let spanEnded = false;
    const endSpan = (statusCode: number, error?: Error): void => {
      if (spanEnded) {
        return;
      }

      spanEnded = true;
      spanHandle.span.setAttributes({
        'http.status_code': statusCode,
      });

      if (error !== undefined) {
        spanHandle.span.recordException(error);
        spanHandle.span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      } else if (statusCode >= 500) {
        spanHandle.span.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        spanHandle.span.setStatus({ code: SpanStatusCode.OK });
      }

      spanHandle.span.end();
    };

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

        endSpan(statusCode);
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
          endSpan(response.statusCode);
        }
      });

      otelContext.with(spanHandle.context, () => next());
    });
  }
}