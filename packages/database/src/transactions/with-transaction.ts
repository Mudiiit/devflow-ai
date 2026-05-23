import type { DatabaseClient, DatabaseTransaction } from '../client/index.js';

export async function withTransaction<T>(db: DatabaseClient, callback: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
  return db.transaction(callback);
}