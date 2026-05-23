import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv, serverEnvSchema } from '@devflow/config';
import { databaseSchema } from '../schema/index.js';
import type { CreateDatabaseClientOptions, DatabaseConnection } from './types.js';

const databaseRuntimeEnvSchema = serverEnvSchema.pick({
  DATABASE_URL: true,
  NODE_ENV: true,
});

const runtimeEnv = loadEnv({
  schema: databaseRuntimeEnvSchema,
  scope: 'server',
});

function resolveSslOption(connectionString: string, sslOption?: CreateDatabaseClientOptions['ssl']): CreateDatabaseClientOptions['ssl'] {
  if (sslOption !== undefined) {
    return sslOption;
  }

  const url = new URL(connectionString);
  const isManagedPostgres = url.hostname.includes('neon.tech') || url.hostname.includes('supabase.co');

  return isManagedPostgres ? { rejectUnauthorized: false } : undefined;
}

// The connection factory is intentionally explicit so app entrypoints can fail
// fast on invalid credentials while still allowing tests and scripts to inject
// a custom connection string or SSL policy.
export function createDatabaseConnection(options: CreateDatabaseClientOptions = {}): DatabaseConnection {
  const connectionString = options.connectionString ?? runtimeEnv.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to create the database client');
  }

  const pool = new Pool({
    connectionString,
    max: options.maxConnections ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: resolveSslOption(connectionString, options.ssl),
  });

  const client = drizzle(pool, {
    schema: databaseSchema,
    logger: options.logger ?? runtimeEnv.NODE_ENV !== 'production',
  });

  return { client, pool };
}