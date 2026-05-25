import { Global, Module, RequestMethod } from '@nestjs/common';
import type { DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { DatabaseClient } from '@devflow/database';
import { AuditLogsRepository, createDatabaseClient } from '@devflow/database';
import { initializeTracing } from '@devflow/tracing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { MetricsController } from './metrics.controller.js';
import { AuditLogService } from './audit-log.service.js';
import { MetricsService } from './metrics.service.js';
import { OBSERVABILITY_OPTIONS } from './observability.tokens.js';
import { ObservabilityExceptionFilter } from './observability-exception.filter.js';
import { ProcessErrorHooksService } from './process-error-hooks.service.js';
import { RequestContextService } from './request-context.service.js';
import { RequestTracingMiddleware } from './request-tracing.middleware.js';
import { StructuredLoggerService } from './structured-logger.service.js';
import type { ObservabilityModuleOptions } from './types.js';

const OBSERVABILITY_DATABASE_CLIENT = Symbol('OBSERVABILITY_DATABASE_CLIENT');

@Global()
@Module({
  controllers: [HealthController, MetricsController],
  providers: [RequestContextService, MetricsService, AuditLogService, ProcessErrorHooksService, RequestTracingMiddleware],
  exports: [RequestContextService, MetricsService, AuditLogService, RequestTracingMiddleware],
})
export class ObservabilityModule implements NestModule {
  static register(options: ObservabilityModuleOptions): DynamicModule {
    const tracingOptions: Parameters<typeof initializeTracing>[0] = {
      serviceName: options.serviceName,
      ...(options.version === undefined ? {} : { serviceVersion: options.version }),
      ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined ? {} : { otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
    };

    try {
      void initializeTracing(tracingOptions);
    } catch (error) {
      console.warn('[observability] tracing initialization failed, continuing without telemetry: %s', error instanceof Error ? error.message : String(error));
    }

    return {
      module: ObservabilityModule,
      providers: [
        {
          provide: OBSERVABILITY_OPTIONS,
          useValue: options,
        },
        {
          provide: StructuredLoggerService,
          inject: [RequestContextService, OBSERVABILITY_OPTIONS],
          useFactory: (requestContextService: RequestContextService, observabilityOptions: ObservabilityModuleOptions) => {
            return new StructuredLoggerService(requestContextService, observabilityOptions.serviceName);
          },
        },
        {
          provide: HealthService,
          inject: [OBSERVABILITY_OPTIONS, OBSERVABILITY_DATABASE_CLIENT, MetricsService],
          useFactory: (
            observabilityOptions: ObservabilityModuleOptions,
            databaseClient: DatabaseClient,
            metricsService: MetricsService,
          ) => {
            return new HealthService(observabilityOptions, databaseClient, metricsService);
          },
        },
        {
          provide: OBSERVABILITY_DATABASE_CLIENT,
          useFactory: () => {
            return createDatabaseClient();
          },
        },
        {
          provide: AuditLogsRepository,
          inject: [OBSERVABILITY_DATABASE_CLIENT],
          useFactory: (databaseClient: DatabaseClient) => {
            return new AuditLogsRepository(databaseClient);
          },
        },
        {
          provide: APP_FILTER,
          useClass: ObservabilityExceptionFilter,
        },
      ],
      exports: [RequestContextService, MetricsService, AuditLogService, StructuredLoggerService, HealthService],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestTracingMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}