import { defineConfig } from 'drizzle-kit';
import { loadEnv, serverEnvSchema } from '@devflow/config';

const drizzleEnvSchema = serverEnvSchema.pick({
  DATABASE_URL: true,
  DIRECT_URL: true,
  POSTGRES_URL: true,
  NEON_DATABASE_URL: true,
});

// The config file is intentionally tiny: it validates only the credentials
// required by Drizzle Kit so the migration pipeline stays fail-fast without
// importing the full runtime client.
const { DATABASE_URL, DIRECT_URL, POSTGRES_URL, NEON_DATABASE_URL } = loadEnv({
  schema: drizzleEnvSchema,
  scope: 'server',
});

const resolvedDatabaseUrl =
  DIRECT_URL ?? POSTGRES_URL ?? NEON_DATABASE_URL ?? DATABASE_URL;

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: resolvedDatabaseUrl,
  },
  strict: true,
  verbose: true,
});