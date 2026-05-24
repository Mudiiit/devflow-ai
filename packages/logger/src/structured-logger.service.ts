import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getCurrentTraceSnapshot } from '@devflow/tracing';
import { RequestContextService } from './request-context.service.js';
import type { ObservabilityMetricLabels } from './types.js';

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'verbose';

type StructuredLogPayload = {
  level: StructuredLogLevel;
  message: string;
  serviceName: string;
  timestamp: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  source?: 'http' | 'worker';
  operation?: string;
  path?: string;
  method?: string;
  jobId?: string;
  metadata?: ObservabilityMetricLabels | Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack: string | undefined;
  };
};

@Injectable()
export class StructuredLoggerService {
  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly serviceName: string,
  ) {}

  debug(message: any, context?: string): void {
    this.write('debug', this.stringifyMessage(message), context === undefined ? {} : { context });
  }

  error(message: any, stack?: string, context?: string): void {
    this.write('error', this.stringifyMessage(message), {
      ...(context === undefined ? {} : { context }),
      ...(stack === undefined ? {} : { errorStack: stack }),
    });
  }

  event(
    level: StructuredLogLevel,
    message: string,
    metadata: Record<string, unknown> = {},
    error?: Error,
  ): void {
    const context = this.requestContextService.current();
    const traceSnapshot = getCurrentTraceSnapshot();
    const requestId = context?.requestId;
    const traceId = context?.traceId ?? traceSnapshot.traceId;
    const spanId = context?.spanId ?? traceSnapshot.spanId;
    const payload: StructuredLogPayload = {
      level,
      message,
      serviceName: this.serviceName,
      timestamp: new Date().toISOString(),
      ...(requestId === undefined ? {} : { requestId }),
      ...(traceId === undefined ? {} : { traceId }),
      ...(spanId === undefined ? {} : { spanId }),
      ...(context === undefined
        ? {}
        : {
            source: context.source,
            operation: context.operation,
            path: context.path,
            method: context.method,
            jobId: context.jobId,
          }),
      metadata,
      ...(error === undefined
        ? {}
        : {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }),
    };

    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(JSON.stringify(payload));
  }

  info(message: string, metadata: Record<string, unknown> = {}): void {
    this.event('info', message, metadata);
  }

  log(message: any, context?: string): void {
    this.write('info', this.stringifyMessage(message), context === undefined ? {} : { context });
  }

  verbose(message: any, context?: string): void {
    this.write('verbose', this.stringifyMessage(message), context === undefined ? {} : { context });
  }

  warn(message: any, context?: string): void {
    this.write('warn', this.stringifyMessage(message), context === undefined ? {} : { context });
  }

  child(metadata: Record<string, unknown>): StructuredLoggerService {
    const scope = typeof metadata.scope === 'string' ? metadata.scope : randomUUID();
    return new StructuredLoggerService(this.requestContextService, `${this.serviceName}:${scope}`);
  }

  private write(level: StructuredLogLevel, message: string, input: { context?: string; errorStack?: string }): void {
    const context = this.requestContextService.current();
    const traceSnapshot = getCurrentTraceSnapshot();
    const requestId = context?.requestId;
    const traceId = context?.traceId ?? traceSnapshot.traceId;
    const spanId = context?.spanId ?? traceSnapshot.spanId;
    const payload: StructuredLogPayload = {
      level,
      message,
      serviceName: this.serviceName,
      timestamp: new Date().toISOString(),
      ...(requestId === undefined ? {} : { requestId }),
      ...(traceId === undefined ? {} : { traceId }),
      ...(spanId === undefined ? {} : { spanId }),
      ...(context === undefined
        ? {}
        : {
            source: context.source,
            operation: context.operation,
            path: context.path,
            method: context.method,
            jobId: context.jobId,
          }),
    };

    if (input.context !== undefined) {
      payload.metadata = { context: input.context };
    }

    if (input.errorStack !== undefined) {
      payload.error = {
        name: 'Error',
        message,
        stack: input.errorStack,
      };
    }

    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(JSON.stringify(payload));
  }

  private stringifyMessage(message: any): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    return JSON.stringify(message);
  }
}