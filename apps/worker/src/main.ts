import { NestFactory } from '@nestjs/core';
import { StructuredLoggerService } from '@devflow/logger';
import { initializeTracing } from '@devflow/tracing';
import { AppModule } from './app.module';

async function bootstrap() {
  await initializeTracing({
    serviceName: 'worker',
    serviceVersion: process.env.npm_package_version,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(StructuredLoggerService, { strict: false }));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
