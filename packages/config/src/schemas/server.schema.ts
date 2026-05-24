import { z } from 'zod';
import { sharedEnvSchema } from './shared.schema.js';

export const serverEnvSchema = sharedEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  SECRET_ENCRYPTION_KEY: z.string().min(32).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(120),
  API_MAX_BODY_BYTES: z.coerce.number().int().min(1024).default(1_000_000),
  API_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(60).default(86_400),
  REVIEW_QUEUE_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  REVIEW_QUEUE_BACKOFF_MS: z.coerce.number().int().min(100).default(10_000),
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_SLUG: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;