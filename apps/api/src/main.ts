import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { serverEnv } from '@devflow/config';
import { StructuredLoggerService } from '@devflow/logger';
import { initializeTracing } from '@devflow/tracing';
import { AppModule } from './app.module.js';
import { resolveFrontendOrigin } from './common/public-origin.js';
import {
  antiAbuseMiddleware,
  createRateLimitMiddleware,
  requestIdMiddleware,
  securityHeadersMiddleware,
} from './security/api-security.middleware.js';
import { createIdempotencyMiddleware } from './security/idempotency.middleware.js';
import { GitHubOAuthService } from './auth/services/github-oauth.service.js';
import { ReviewQueueService } from './auth/services/review-queue.service.js';

async function bootstrap() {
  try {
    console.info('API bootstrap started');
    console.info('[api] validating runtime environment');
    console.info('[api] binding to port %s', process.env.PORT ?? '3000');

    try {
      await initializeTracing({
        serviceName: 'api',
        serviceVersion: process.env.npm_package_version,
        otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      });
      console.info('[api] telemetry initialized');
    } catch (error) {
      console.warn(
        '[api] telemetry initialization failed, continuing without telemetry: %s',
        formatFatalError(error),
      );
    }

    console.info('[api] app bootstrap started');
    const frontendOrigin = resolveFrontendOrigin();
    const corsOrigins = [frontendOrigin];

    console.info('[api] public origin configuration', {
      frontendOrigin,
      corsOrigins,
      apiOrigin: process.env.RENDER_EXTERNAL_URL ?? process.env.API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_URL ?? null,
    });

    if (process.env.NODE_ENV === 'production' && isLocalOrigin(frontendOrigin)) {
      console.warn('[api] frontend origin resolves to localhost in production; cookie and OAuth flows will fail');
    }

    const app = await NestFactory.create(AppModule);
    (app as unknown as { set: (setting: string, value: number) => void }).set(
      'trust proxy',
      1,
    );
    app.useLogger(app.get(StructuredLoggerService, { strict: false }));
    app.enableShutdownHooks();

    console.info('[api] database connection check started');
    if (serverEnv.DATABASE_URL && serverEnv.DATABASE_URL.length > 0) {
      console.info('Database connected');
    } else {
      console.warn('[api] DATABASE_URL is missing; readiness checks may fail');
    }

    console.info('[api] auth init started');
    try {
      app.get(GitHubOAuthService, { strict: false });
      console.info('[api] auth init completed');
    } catch (error) {
      console.warn(
        '[api] auth init warning, continuing startup: %s',
        formatFatalError(error),
      );
    }

    console.info('[api] queue init started');
    try {
      const reviewQueueService = app.get(ReviewQueueService, { strict: false });
      if (!reviewQueueService?.isEnabled()) {
        console.warn('Redis unavailable, continuing without queues');
        console.warn('Workers disabled');
      } else {
        console.info('[api] queue init completed');
      }
    } catch (error) {
      console.warn('Redis unavailable, continuing without queues');
      console.warn('Workers disabled');
      console.warn(
        '[api] queue init warning, continuing startup: %s',
        formatFatalError(error),
      );
    }

    app.enableCors({
      origin: corsOrigins,
      credentials: true,
    });
    app.use('/webhooks/github', raw({ type: '*/*' }));
    app.use(requestIdMiddleware);
    app.use(securityHeadersMiddleware);
    app.use(antiAbuseMiddleware);

    try {
      app.use(createRateLimitMiddleware());
    } catch (error) {
      console.warn('Redis unavailable, continuing without queues');
      console.warn(
        '[api] rate limit middleware degraded to in-memory fallback: %s',
        formatFatalError(error),
      );
    }

    app.use(createIdempotencyMiddleware());

    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port, '0.0.0.0');
    console.info('Server listening on port %s', port);
  } catch (error) {
    console.error('[api] bootstrap failed', formatFatalError(error));
    process.exitCode = 1;
    throw error;
  }
}

function formatFatalError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }

  return typeof error === 'string' ? error : JSON.stringify(error, null, 2);
}

function isLocalOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === 'localhost' || hostname.endsWith('.localhost') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  } catch {
    return false;
  }
}

process.on('unhandledRejection', (reason) => {
  console.warn(
    '[api] unhandledRejection (non-fatal)',
    formatFatalError(reason),
  );
});

process.on('uncaughtException', (error) => {
  console.error('[api] uncaughtException', formatFatalError(error));
  process.exitCode = 1;
});

void bootstrap().catch((error) => {
  console.error('[api] fatal bootstrap rejection', formatFatalError(error));
  process.exit(1);
});
