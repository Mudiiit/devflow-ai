import { Injectable } from '@nestjs/common';
import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';
import { StructuredLoggerService } from './structured-logger.service.js';

@Injectable()
export class ProcessErrorHooksService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly listeners = new Map<string, (...args: unknown[]) => void>();

  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly metricsService: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const unhandledRejection = (reason: unknown) => {
      this.metricsService.increment('devflow_process_unhandled_rejections_total', { service: 'process' });
      this.logger.event('error', 'process.unhandled_rejection', {
        reason: reason instanceof Error ? reason.message : reason,
      }, reason instanceof Error ? reason : undefined);
    };

    const uncaughtException = (error: unknown) => {
      this.metricsService.increment('devflow_process_uncaught_exceptions_total', { service: 'process' });
      this.logger.event('error', 'process.uncaught_exception', {
        error: error instanceof Error ? error.message : error,
      }, error instanceof Error ? error : undefined);
      process.exitCode = 1;
    };

    process.on('unhandledRejection', unhandledRejection);
    process.on('uncaughtException', uncaughtException);
    this.listeners.set('unhandledRejection', unhandledRejection);
    this.listeners.set('uncaughtException', uncaughtException);
  }

  onApplicationShutdown(): void {
    const rejection = this.listeners.get('unhandledRejection');
    const exception = this.listeners.get('uncaughtException');

    if (rejection !== undefined) {
      process.off('unhandledRejection', rejection);
    }

    if (exception !== undefined) {
      process.off('uncaughtException', exception);
    }
  }
}