import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { serverEnv } from '@devflow/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [serverEnv.NEXTAUTH_URL ?? 'http://localhost:3000'],
    credentials: true,
  });
  app.use('/webhooks/github', raw({ type: '*/*' }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
