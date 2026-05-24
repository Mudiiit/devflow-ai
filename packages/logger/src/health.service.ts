import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@devflow/database';
import type { HealthCheckResult, ObservabilityModuleOptions } from './types.js';
import { MetricsService } from './metrics.service.js';

export class HealthService {
  constructor(
    private readonly options: ObservabilityModuleOptions,
    private readonly databaseClient: DatabaseClient,
    private readonly metricsService: MetricsService,
  ) {}

  async live(): Promise<Record<string, unknown>> {
    return {
      status: 'ok',
      service: this.options.serviceName,
      version: this.options.version ?? 'unknown',
      uptimeMs: Math.round(process.uptime() * 1000),
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<{ readonly status: 'ok' | 'error'; readonly checks: HealthCheckResult[]; readonly metrics: number }> {
    const startedAt = Date.now();

    try {
      await this.databaseClient.execute(sql`select 1`);
      const durationMs = Date.now() - startedAt;
      this.metricsService.setGauge('devflow_health_database_ready', 1, { service: this.options.serviceName });

      return {
        status: 'ok',
        checks: [
          {
            name: 'database',
            status: 'ok',
            durationMs,
          },
        ],
        metrics: this.metricsService.snapshot().length,
      };
    } catch (error: unknown) {
      const durationMs = Date.now() - startedAt;
      this.metricsService.setGauge('devflow_health_database_ready', 0, { service: this.options.serviceName });

      return {
        status: 'error',
        checks: [
          {
            name: 'database',
            status: 'error',
            durationMs,
            details: {
              error: error instanceof Error ? error.message : 'Unknown readiness failure',
            },
          },
        ],
        metrics: this.metricsService.snapshot().length,
      };
    }
  }
}