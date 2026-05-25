import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { serverEnv } from '@devflow/config';
import { StructuredLoggerService } from '@devflow/logger';
import { initializeTracing } from '@devflow/tracing';
import { AppModule } from './app.module.js';
import {
  antiAbuseMiddleware,
  createRateLimitMiddleware,
  requestIdMiddleware,
  securityHeadersMiddleware,
} from './security/api-security.middleware.js';
import { createIdempotencyMiddleware } from './security/idempotency.middleware.js';

async function bootstrap() {
  try {
    console.info('[api] starting bootstrap');
    console.info('[api] validating runtime environment');
    console.info('[api] binding to port %s', process.env.PORT ?? '3000');

    await initializeTracing({
      serviceName: 'api',
      serviceVersion: process.env.npm_package_version,
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    });

    const app = await NestFactory.create(AppModule);
    app.useLogger(app.get(StructuredLoggerService, { strict: false }));
    app.enableShutdownHooks();
    app.enableCors({
      origin: [serverEnv.NEXTAUTH_URL ?? 'http://localhost:3000'],
      credentials: true,
    });
    app.use('/webhooks/github', raw({ type: '*/*' }));
    app.use(requestIdMiddleware);
    app.use(securityHeadersMiddleware);
    app.use(antiAbuseMiddleware);
    app.use(createRateLimitMiddleware());
    app.use(createIdempotencyMiddleware());

    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port, '0.0.0.0');
    console.info('[api] listening on 0.0.0.0:%s', port);
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

process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandledRejection', formatFatalError(reason));
});

process.on('uncaughtException', (error) => {
  console.error('[api] uncaughtException', formatFatalError(error));
  process.exitCode = 1;
});

void bootstrap().catch((error) => {
  console.error('[api] fatal bootstrap rejection', formatFatalError(error));
  process.exit(1);
});
