import { createDatabaseConnection } from './connection.js';
import type { CreateDatabaseClientOptions, DatabaseClient, DatabaseConnection, DatabaseTransaction } from './types.js';

export type { CreateDatabaseClientOptions, DatabaseClient, DatabaseConnection, DatabaseTransaction } from './types.js';

export function createDatabaseClient(options: CreateDatabaseClientOptions = {}): DatabaseClient {
  return createDatabaseConnection(options).client;
}

export function createDatabaseRuntime(options: CreateDatabaseClientOptions = {}): DatabaseConnection {
  return createDatabaseConnection(options);
}

let defaultDatabaseConnection: DatabaseConnection | undefined;

function getDefaultDatabaseConnection(): DatabaseConnection {
  if (!defaultDatabaseConnection) {
    defaultDatabaseConnection = createDatabaseConnection();
  }

  return defaultDatabaseConnection;
}

export const db = new Proxy({} as DatabaseClient, {
  get(_target, property, receiver) {
    const client = getDefaultDatabaseConnection().client;
    const value = Reflect.get(client as object, property, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as DatabaseClient;

export const pool = new Proxy({} as import('pg').Pool, {
  get(_target, property, receiver) {
    const runtimePool = getDefaultDatabaseConnection().pool;
    const value = Reflect.get(runtimePool as object, property, receiver);
    return typeof value === 'function' ? value.bind(runtimePool) : value;
  },
}) as import('pg').Pool;

export async function closeDatabaseConnection(): Promise<void> {
  if (!defaultDatabaseConnection) {
    return;
  }

  await defaultDatabaseConnection.pool.end();
  defaultDatabaseConnection = undefined;
}