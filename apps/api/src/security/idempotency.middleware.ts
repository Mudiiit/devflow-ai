import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { serverEnv } from '@devflow/config';

type CachedResponse = {
  requestHash: string;
  statusCode: number;
  body: unknown;
  expiresAt: number;
};

const writeJson = (response: Response, statusCode: number, body: unknown): void => {
  response.status(statusCode).json(body);
};

const shouldHandleMethod = (method: string): boolean => {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
};

const getHeaderValue = (request: Request, name: string): string | null => {
  const value = request.headers[name.toLowerCase()];
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
};

export const createIdempotencyMiddleware = (): ((request: Request, response: Response, next: NextFunction) => void) => {
  const cache = new Map<string, CachedResponse>();
  const ttlSeconds = serverEnv.API_IDEMPOTENCY_TTL_SECONDS;

  return (request: Request, response: Response, next: NextFunction): void => {
    if (!shouldHandleMethod(request.method)) {
      next();
      return;
    }

    const rawKey = getHeaderValue(request, 'x-idempotency-key');
    if (!rawKey) {
      next();
      return;
    }

    const key = `${request.method.toUpperCase()}:${request.originalUrl}:${rawKey}`;
    const requestHash = createHash('sha256')
      .update(JSON.stringify({
        query: request.query,
        body: request.body ?? {},
      }))
      .digest('hex');

    const now = Date.now();
    const existing = cache.get(key);
    if (existing && existing.expiresAt > now) {
      if (existing.requestHash !== requestHash) {
        writeJson(response, 409, {
          message: 'Idempotency key already used with a different request payload',
        });
        return;
      }

      writeJson(response, existing.statusCode, existing.body);
      return;
    }

    const originalJson = response.json.bind(response);

    response.json = (body: unknown) => {
      const statusCode = response.statusCode;

      if (statusCode < 500) {
        cache.set(key, {
          requestHash,
          statusCode,
          body,
          expiresAt: now + ttlSeconds * 1000,
        });
      }

      return originalJson(body);
    };

    next();
  };
};
