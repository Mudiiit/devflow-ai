import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv, serverEnvSchema } from '@devflow/config';
import { databaseSchema } from '../schema/index.js';
import type { CreateDatabaseClientOptions, DatabaseConnection } from './types.js';
import { SpanKind } from '@opentelemetry/api';
import { runWithSpan } from '@devflow/tracing';

const databaseRuntimeEnvSchema = serverEnvSchema.pick({
  DATABASE_URL: true,
  DIRECT_URL: true,
  POSTGRES_URL: true,
  NEON_DATABASE_URL: true,
  NODE_ENV: true,
  DATABASE_POOL_MAX_CONNECTIONS: true,
  DATABASE_CONNECTION_TIMEOUT_MS: true,
  DATABASE_IDLE_TIMEOUT_MS: true,
  DATABASE_QUERY_TIMEOUT_MS: true,
});

const runtimeEnv = loadEnv({
  schema: databaseRuntimeEnvSchema,
  scope: 'server',
});

const DEFAULT_QUERY_TIMEOUT_MS = 15_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

const isClearlyLocalHost = (hostname: string): boolean => {
  return (
    hostname === 'localhost' ||
    hostname === 'postgres' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
};

const resolveDatabaseConnectionString = (
  options: CreateDatabaseClientOptions,
): { connectionString: string; source: string } => {
  if (options.connectionString) {
    return {
      connectionString: options.connectionString,
      source: 'explicit connection string',
    };
  }

  const directConnectionString =
    runtimeEnv.DIRECT_URL ??
    runtimeEnv.POSTGRES_URL ??
    runtimeEnv.NEON_DATABASE_URL;

  if (directConnectionString) {
    return {
      connectionString: directConnectionString,
      source: runtimeEnv.DIRECT_URL
        ? 'DIRECT_URL'
        : runtimeEnv.POSTGRES_URL
          ? 'POSTGRES_URL'
          : 'NEON_DATABASE_URL',
    };
  }

  if (!runtimeEnv.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to create the database client');
  }

  return {
    connectionString: runtimeEnv.DATABASE_URL,
    source: 'DATABASE_URL',
  };
};

const describeConnectionString = (connectionString: string): { host: string; database: string; protocol: string } => {
  const url = new URL(connectionString);

  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, '') || '(default)',
    protocol: url.protocol.replace(/:$/, ''),
  };
};

const sanitizeConnectionString = (connectionString: string): string => {
  const url = new URL(connectionString);

  if (url.hostname.includes('neon.tech')) {
    url.searchParams.set('sslmode', 'require');
  }

  return url.toString();
};

const readSqlText = (query: unknown): string => {
  if (typeof query === 'string') {
    return query;
  }

  if (typeof query === 'object' && query !== null && 'text' in query && typeof (query as { text?: unknown }).text === 'string') {
    return (query as { text: string }).text;
  }

  return 'unknown';
};

const patchQueryMethod = <TQuery extends (...args: readonly unknown[]) => Promise<unknown>>(
  pool: Pool,
  queryMethod: TQuery,
  releaseClient?: (destroy?: boolean) => void,
  queryTimeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): TQuery => {
  return (async (...args: Parameters<TQuery>) => {
    const statement = readSqlText(args[0]);
    const startedAt = Date.now();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const timeoutError = new Error(`[db] query timed out after ${queryTimeoutMs}ms`);
        console.warn('[db] query timeout', {
          statement: statement.slice(0, 1_024),
          timeoutMs: queryTimeoutMs,
          durationMs: Date.now() - startedAt,
          pool: {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
          },
        });

        try {
          releaseClient?.(true);
        } catch (releaseError) {
          console.warn('[db] client release after timeout failed', {
            message: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        }

        reject(timeoutError);
      }, queryTimeoutMs);
    });

    console.info('[db] query started', {
      statement: statement.slice(0, 1_024),
      timeoutMs: queryTimeoutMs,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
    });

    try {
      const result = await runWithSpan('db.query', {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.statement': statement.slice(0, 1_024),
          'db.operation': statement.split(/\s+/)[0]?.toLowerCase() ?? 'query',
        },
      }, async () => {
        const queryPromise = queryMethod(...args);
        const racedResult = await Promise.race([queryPromise, timeoutPromise]);
        return racedResult;
      });

      console.info('[db] query completed', {
        statement: statement.slice(0, 1_024),
        durationMs: Date.now() - startedAt,
        pool: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
      });

      return result;
    } catch (error) {
      console.warn('[db] query failed', {
        statement: statement.slice(0, 1_024),
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
        pool: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
      });

      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }) as TQuery;
};

const instrumentPool = (pool: Pool): void => {
  pool.on('connect', () => {
    console.info('[db] pool client connected', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
  });

  pool.on('acquire', () => {
    console.info('[db] pool client acquired', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
  });

  pool.on('error', (error) => {
    console.warn('[db] pool error', {
      message: error instanceof Error ? error.message : String(error),
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
  });

  pool.query = patchQueryMethod(pool, pool.query.bind(pool));

  const originalConnect = pool.connect.bind(pool);
  pool.connect = (async () => {
    console.info('[db] pool connect start', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });
    const client = await originalConnect();

    console.info('[db] pool connect acquired', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    });

    const originalRelease = client.release.bind(client);
    client.release = ((destroy?: boolean | Error) => {
      console.info('[db] client release start', {
        destroy: Boolean(destroy),
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      });

      try {
        const result = originalRelease(destroy as never);
        console.info('[db] client release complete', {
          destroy: Boolean(destroy),
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        });
        return result;
      } catch (error) {
        console.warn('[db] client release failed', {
          destroy: Boolean(destroy),
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }) as typeof client.release;

    client.query = patchQueryMethod(pool, client.query.bind(client), (destroy?: boolean) => client.release(destroy ? new Error('query timeout') : undefined));
    return client;
  }) as Pool['connect'];
};

function resolveSslOption(connectionString: string, sslOption?: CreateDatabaseClientOptions['ssl']): CreateDatabaseClientOptions['ssl'] {
  if (sslOption !== undefined) {
    return sslOption;
  }

  const url = new URL(connectionString);
  const isManagedPostgres = url.hostname.includes('neon.tech') || url.hostname.includes('supabase.co') || url.hostname.includes('render.com');

  return isManagedPostgres ? { rejectUnauthorized: false } : undefined;
}

// The connection factory is intentionally explicit so app entrypoints can fail
// fast on invalid credentials while still allowing tests and scripts to inject
// a custom connection string or SSL policy.
export function createDatabaseConnection(options: CreateDatabaseClientOptions = {}): DatabaseConnection {
  const resolvedConnection = resolveDatabaseConnectionString(options);
  const rawConnectionString = resolvedConnection.connectionString;
  const connectionString = sanitizeConnectionString(rawConnectionString);

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to create the database client');
  }

  if (runtimeEnv.NODE_ENV === 'production' && isClearlyLocalHost(new URL(connectionString).hostname.toLowerCase())) {
    throw new Error(
      `Production database host resolves to ${new URL(connectionString).hostname}, which is not reachable from Render. Set DATABASE_URL to the managed Postgres host and avoid Compose-only hostnames such as postgres or localhost.`,
    );
  }

  const connectionDetails = describeConnectionString(connectionString);
  const ssl = resolveSslOption(connectionString, options.ssl);

  console.info('[db] creating postgres pool', {
    source: resolvedConnection.source,
    ...connectionDetails,
    sslEnabled: ssl !== undefined,
    sslRejectUnauthorized: typeof ssl === 'object' && ssl !== null && 'rejectUnauthorized' in ssl ? (ssl as { rejectUnauthorized?: boolean }).rejectUnauthorized ?? null : null,
    maxConnections: options.maxConnections ?? runtimeEnv.DATABASE_POOL_MAX_CONNECTIONS ?? 10,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? runtimeEnv.DATABASE_CONNECTION_TIMEOUT_MS ?? DEFAULT_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: options.idleTimeoutMillis ?? runtimeEnv.DATABASE_IDLE_TIMEOUT_MS ?? DEFAULT_IDLE_TIMEOUT_MS,
    queryTimeoutMillis: options.queryTimeoutMillis ?? runtimeEnv.DATABASE_QUERY_TIMEOUT_MS ?? DEFAULT_QUERY_TIMEOUT_MS,
    sanitizedConnectionString: connectionString !== rawConnectionString,
  });

  const pool = new Pool({
    connectionString,
    max: options.maxConnections ?? runtimeEnv.DATABASE_POOL_MAX_CONNECTIONS ?? 10,
    idleTimeoutMillis: options.idleTimeoutMillis ?? runtimeEnv.DATABASE_IDLE_TIMEOUT_MS ?? DEFAULT_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? runtimeEnv.DATABASE_CONNECTION_TIMEOUT_MS ?? DEFAULT_CONNECTION_TIMEOUT_MS,
    ssl,
  });

  instrumentPool(pool);

  const client = drizzle(pool, {
    schema: databaseSchema,
    logger: options.logger ?? runtimeEnv.NODE_ENV !== 'production',
  });

  return { client, pool };
}