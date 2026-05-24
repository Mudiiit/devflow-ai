import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv, serverEnvSchema } from '@devflow/config';
import { databaseSchema } from '../schema/index.js';
import type { CreateDatabaseClientOptions, DatabaseConnection } from './types.js';
import { SpanKind } from '@opentelemetry/api';
import { runWithSpan } from '@devflow/tracing';

const databaseRuntimeEnvSchema = serverEnvSchema.pick({
  DATABASE_URL: true,
  NODE_ENV: true,
});

const runtimeEnv = loadEnv({
  schema: databaseRuntimeEnvSchema,
  scope: 'server',
});

const readSqlText = (query: unknown): string => {
  if (typeof query === 'string') {
    return query;
  }

  if (typeof query === 'object' && query !== null && 'text' in query && typeof (query as { text?: unknown }).text === 'string') {
    return (query as { text: string }).text;
  }

  return 'unknown';
};

const patchQueryMethod = <TQuery extends (...args: readonly unknown[]) => Promise<unknown>>(queryMethod: TQuery): TQuery => {
  return (async (...args: Parameters<TQuery>) => {
    const statement = readSqlText(args[0]);

    return runWithSpan('db.query', {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.statement': statement.slice(0, 1_024),
        'db.operation': statement.split(/\s+/)[0]?.toLowerCase() ?? 'query',
      },
    }, async () => {
      return queryMethod(...args);
    });
  }) as TQuery;
};

const instrumentPool = (pool: Pool): void => {
  pool.query = patchQueryMethod(pool.query.bind(pool));

  const originalConnect = pool.connect.bind(pool);
  pool.connect = (async () => {
    const client = await originalConnect();
    client.query = patchQueryMethod(client.query.bind(client));
    return client;
  }) as Pool['connect'];
};

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

  instrumentPool(pool);

  const client = drizzle(pool, {
    schema: databaseSchema,
    logger: options.logger ?? runtimeEnv.NODE_ENV !== 'production',
  });

  return { client, pool };
}