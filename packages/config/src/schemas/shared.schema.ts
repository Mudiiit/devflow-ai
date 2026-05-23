import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']);

export const sharedEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;