import { loadEnv } from './loader.js';
import { clientEnvSchema } from './schemas/client.schema.js';

export const clientEnv = loadEnv({
  schema: clientEnvSchema,
  scope: 'client',
  loadEnvFiles: false,
});

export type { ClientEnv } from './schemas/client.schema.js';