import { defineConfig } from 'drizzle-kit';
import { loadEnv, serverEnvSchema } from '@devflow/config';

const drizzleEnvSchema = serverEnvSchema.pick({
  DATABASE_URL: true,
});

// The config file is intentionally tiny: it validates only the credentials
// required by Drizzle Kit so the migration pipeline stays fail-fast without
// importing the full runtime client.
const { DATABASE_URL } = loadEnv({
  schema: drizzleEnvSchema,
  scope: 'server',
});

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
  strict: true,
  verbose: true,
});