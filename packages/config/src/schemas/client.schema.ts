import { z } from 'zod';
import { sharedEnvSchema } from './shared.schema.js';

export const clientEnvSchema = sharedEnvSchema.extend({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('DevFlow AI'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_GITHUB_REPO: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;