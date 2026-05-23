import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { DatabaseSchema } from '../schema/index.js';

export type DatabaseClient = NodePgDatabase<DatabaseSchema>;
export type DatabaseTransaction = Parameters<DatabaseClient['transaction']>[0] extends (
  tx: infer TTransaction,
  ...args: never[]
) => unknown
  ? TTransaction
  : never;

export interface CreateDatabaseClientOptions {
  connectionString?: string;
  logger?: boolean;
  ssl?: boolean | Record<string, unknown>;
  maxConnections?: number;
}

export interface DatabaseConnection {
  client: DatabaseClient;
  pool: import('pg').Pool;
}