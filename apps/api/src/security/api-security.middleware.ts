import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { createRedisConnection, isRedisConnectionEnabled, serverEnv } from '@devflow/config';

type RateLimitBucket = Readonly<{
  count: number;
  resetAt: number;
}>;

const isBypassedRoute = (path: string): boolean => {
  return path.startsWith('/health') || path.startsWith('/metrics') || path.startsWith('/webhooks/github');
};

const hasSuspiciousPattern = (value: string): boolean => {
  return /(<script|\bunion\s+select\b|\bdrop\s+table\b|\bor\s+1=1\b)/i.test(value);
};

const resolveClientIp = (request: Request): string => {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }

  return request.ip ?? 'unknown';
};

export const requestIdMiddleware = (request: Request & { requestId?: string }, response: Response, next: NextFunction): void => {
  const incoming = request.headers['x-request-id'];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const requestId = candidate && candidate.length > 0 ? candidate : randomUUID();

  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
};

export const securityHeadersMiddleware = (_request: Request, response: Response, next: NextFunction): void => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
  response.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  response.setHeader('X-DNS-Prefetch-Control', 'off');
  if (serverEnv.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
};

export const antiAbuseMiddleware = (request: Request, response: Response, next: NextFunction): void => {
  const path = request.originalUrl ?? request.url;

  if (isBypassedRoute(path)) {
    next();
    return;
  }

  const userAgent = request.headers['user-agent'] ?? '';
  if (typeof userAgent === 'string' && userAgent.length === 0) {
    response.status(400).json({ message: 'Missing user-agent header' });
    return;
  }

  const serialized = JSON.stringify({
    query: request.query,
    body: request.body ?? {},
  });

  if (hasSuspiciousPattern(serialized)) {
    response.status(403).json({ message: 'Suspicious request blocked' });
    return;
  }

  const contentLength = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > serverEnv.API_MAX_BODY_BYTES) {
    response.status(413).json({ message: 'Payload too large' });
    return;
  }

  next();
};

export const createRateLimitMiddleware = (): ((request: Request, response: Response, next: NextFunction) => void) => {
  const windowMs = serverEnv.API_RATE_LIMIT_WINDOW_MS;
  const maxRequests = serverEnv.API_RATE_LIMIT_MAX_REQUESTS;
  const buckets = new Map<string, RateLimitBucket>();
  let redis: any | null = null;

  if (isRedisConnectionEnabled(serverEnv.REDIS_URL)) {
    try {
      redis = createRedisConnection(serverEnv.REDIS_URL!, 'devflow-api-rate-limit');
      if (redis && typeof redis.on === 'function') {
        redis.on('error', (error: unknown) => {
          console.warn('[api] rate limiter redis error, using in-memory limiter: %s', error instanceof Error ? error.message : String(error));
        });
      }
    } catch (error) {
      redis = null;
      console.warn('[api] rate limiter redis initialization failed, using in-memory limiter: %s', error instanceof Error ? error.message : String(error));
    }
  }

  // expose redis instance for process-module shutdown hooks to close connection
  try {
    if (redis) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).__devflow_api_rate_limit_redis = redis;
    }
  } catch (e) {
    // ignore
  }

  return (request: Request, response: Response, next: NextFunction): void => {
    const path = request.originalUrl ?? request.url;

    if (isBypassedRoute(path)) {
      next();
      return;
    }

    const key = `${resolveClientIp(request)}:${request.method}:${path}`;
    const now = Date.now();

    if (redis) {
      void (async () => {
        const redisKey = `rate-limit:${key}`;
        const count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.pexpire(redisKey, windowMs);
        }

        if (count > maxRequests) {
          const ttl = await redis.pttl(redisKey);
          const retryAfterSeconds = Math.max(1, Math.ceil(ttl / 1000));
          response.setHeader('Retry-After', String(retryAfterSeconds));
          response.status(429).json({
            status: 'error',
            message: 'Rate limit exceeded',
          });
          return;
        }

        response.setHeader('X-RateLimit-Limit', String(maxRequests));
        response.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));
        next();
      })().catch(() => {
        next();
      });
      return;
    }

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