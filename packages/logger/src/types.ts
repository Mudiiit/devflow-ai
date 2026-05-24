import type { InjectionToken } from '@nestjs/common';

export type ObservabilityMetricLabels = Readonly<Record<string, string | number | boolean | null | undefined>>;

export type ObservabilityRequestContext = Readonly<{
  readonly requestId: string;
  readonly traceId: string;
  readonly serviceName: string;
  readonly source: 'http' | 'worker';
  readonly operation?: string;
  readonly path?: string;
  readonly method?: string;
  readonly jobId?: string;
  readonly correlationId?: string;
  readonly startedAt: number;
}>;

export type ObservabilityModuleOptions = Readonly<{
  readonly serviceName: string;
  readonly databaseClientToken: InjectionToken;
  readonly version?: string;
}>;

export type HealthCheckResult = Readonly<{
  readonly name: string;
  readonly status: 'ok' | 'error';
  readonly durationMs: number;
  readonly details?: Record<string, unknown>;
}>;

export type PrometheusMetricSnapshot = Readonly<{
  readonly name: string;
  readonly labels: ObservabilityMetricLabels;
  readonly value: number;
  readonly kind: 'counter' | 'gauge' | 'histogram';
}>;