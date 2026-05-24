import type { NextFunction, Request, Response } from 'express';
import { serverEnv } from '@devflow/config';

type RateLimitBucket = Readonly<{
  count: number;
  resetAt: number;
}>;

const isBypassedRoute = (path: string): boolean => {
  return path.startsWith('/health') || path.startsWith('/metrics') || path.startsWith('/webhooks/github');
};

export const securityHeadersMiddleware = (_request: Request, response: Response, next: NextFunction): void => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
};

export const createRateLimitMiddleware = (): ((request: Request, response: Response, next: NextFunction) => void) => {
  const windowMs = serverEnv.API_RATE_LIMIT_WINDOW_MS;
  const maxRequests = serverEnv.API_RATE_LIMIT_MAX_REQUESTS;
  const buckets = new Map<string, RateLimitBucket>();

  return (request: Request, response: Response, next: NextFunction): void => {
    const path = request.originalUrl ?? request.url;

    if (isBypassedRoute(path)) {
      next();
      return;
    }

    const key = `${request.ip}:${request.method}:${path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (bucket === undefined || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      response.setHeader('Retry-After', String(retryAfterSeconds));
      response.status(429).json({
        status: 'error',
        message: 'Rate limit exceeded',
      });
      return;
    }

    buckets.set(key, { ...bucket, count: bucket.count + 1 });
    next();
  };
};