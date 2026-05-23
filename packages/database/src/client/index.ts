import { createDatabaseConnection } from './connection.js';
import type { CreateDatabaseClientOptions, DatabaseClient, DatabaseConnection, DatabaseTransaction } from './types.js';

export type { CreateDatabaseClientOptions, DatabaseClient, DatabaseConnection, DatabaseTransaction } from './types.js';

export function createDatabaseClient(options: CreateDatabaseClientOptions = {}): DatabaseClient {
  return createDatabaseConnection(options).client;
}

export function createDatabaseRuntime(options: CreateDatabaseClientOptions = {}): DatabaseConnection {
  return createDatabaseConnection(options);
}

// The default export is resolved eagerly on the server so application startup
// fails immediately if the database URL is missing or malformed.
export const { client: db, pool } = createDatabaseConnection();

export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
}