import { loadEnv } from './loader.js';
import { serverEnvSchema } from './schemas/server.schema.js';

export const serverEnv = loadEnv({
  schema: serverEnvSchema,
  scope: 'server',
  loadEnvFiles: true,
});

export type { ServerEnv } from './schemas/server.schema.js';