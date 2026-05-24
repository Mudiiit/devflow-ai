import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '@devflow/database';
import { createRedisConnection, isRedisConnectionEnabled } from '@devflow/config';
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
    const checks: HealthCheckResult[] = [];

    try {
      const databaseStartedAt = Date.now();
      await this.databaseClient.execute(sql`select 1`);
      checks.push({
        name: 'database',
        status: 'ok',
        durationMs: Date.now() - databaseStartedAt,
      });
      this.metricsService.setGauge('devflow_health_database_ready', 1, { service: this.options.serviceName });

      const redisUrl = process.env.REDIS_URL;
      if (isRedisConnectionEnabled(redisUrl)) {
        const redisStartedAt = Date.now();
        const redis = createRedisConnection(redisUrl, `devflow-${this.options.serviceName}-health`);

        try {
          await redis.ping();
          checks.push({
            name: 'redis',
            status: 'ok',
            durationMs: Date.now() - redisStartedAt,
          });
          this.metricsService.setGauge('devflow_health_redis_ready', 1, { service: this.options.serviceName });
        } catch (error: unknown) {
          checks.push({
            name: 'redis',
            status: 'error',
            durationMs: Date.now() - redisStartedAt,
            details: {
              error: error instanceof Error ? error.message : 'Unknown readiness failure',
            },
          });
          this.metricsService.setGauge('devflow_health_redis_ready', 0, { service: this.options.serviceName });
          return {
            status: 'error',
            checks,
            metrics: this.metricsService.snapshot().length,
          };
        } finally {
          await redis.quit();
        }
      }

      return {
        status: 'ok',
        checks,
        metrics: this.metricsService.snapshot().length,
      };
    } catch (error: unknown) {
      this.metricsService.setGauge('devflow_health_database_ready', 0, { service: this.options.serviceName });

      checks.push({
        name: 'database',
        status: 'error',
        durationMs: 0,
        details: {
          error: error instanceof Error ? error.message : 'Unknown readiness failure',
        },
      });

      return {
        status: 'error',
        checks,
        metrics: this.metricsService.snapshot().length,
      };
    }
  }
}