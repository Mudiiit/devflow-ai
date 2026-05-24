import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { serverEnv } from '@devflow/config';
import { StructuredLoggerService } from '@devflow/logger';
import { initializeTracing } from '@devflow/tracing';
import { AppModule } from './app.module';
import { createRateLimitMiddleware, securityHeadersMiddleware } from './security/api-security.middleware.js';

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
  app.use(securityHeadersMiddleware);
  app.use(createRateLimitMiddleware());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
