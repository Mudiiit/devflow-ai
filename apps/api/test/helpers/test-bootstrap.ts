import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';

export interface TestContext {
  app: INestApplication;
  module: TestingModule;
}

export const bootstrapTestApp = async (): Promise<TestContext> => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  await app.init();

  return {
    app,
    module,
  };
};

export const assertTestDatabaseEnv = (): void => {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (databaseUrl.length === 0) {
    throw new Error('DATABASE_URL must be set for integration tests');
  }

  if (!/test/i.test(databaseUrl)) {
    throw new Error('Integration tests must target a test database URL containing "test"');
  }
};
