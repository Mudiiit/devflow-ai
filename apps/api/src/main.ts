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
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
