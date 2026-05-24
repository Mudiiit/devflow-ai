import { NestFactory } from '@nestjs/core';
import { StructuredLoggerService } from '@devflow/logger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(StructuredLoggerService, { strict: false }));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
