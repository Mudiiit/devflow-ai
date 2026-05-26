import request from 'supertest';
import type { App } from 'supertest/types';
import type { INestApplication } from '@nestjs/common';
import {
  assertTestDatabaseEnv,
  bootstrapTestApp,
} from '../helpers/test-bootstrap.js';

describe('API security integration', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    assertTestDatabaseEnv();
    const bootstrapped = await bootstrapTestApp();
    app = bootstrapped.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes hardening headers on health endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(404);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
  });
});
