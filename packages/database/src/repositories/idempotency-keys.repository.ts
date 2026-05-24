import { and, eq, gt, lt } from 'drizzle-orm';
import { idempotencyKeys } from '../schema/idempotency-keys.js';
import type { DatabaseClient } from '../client/index.js';
import type { NewIdempotencyKey } from '../schema/idempotency-keys.js';
import { BaseRepository } from './base.repository.js';

export class IdempotencyKeysRepository extends BaseRepository<typeof idempotencyKeys> {
  constructor(db: DatabaseClient) {
    super(db, idempotencyKeys, idempotencyKeys.id);
  }

  async findByRequestKey(idempotencyKey: string, method: string, path: string) {
    const rows = await this.db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.idempotencyKey, idempotencyKey),
          eq(idempotencyKeys.requestMethod, method),
          eq(idempotencyKeys.requestPath, path),
          gt(idempotencyKeys.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async upsertRecord(input: NewIdempotencyKey) {
    const rows = await this.db
      .insert(idempotencyKeys)
      .values(input)
      .onConflictDoUpdate({
        target: [idempotencyKeys.idempotencyKey, idempotencyKeys.requestMethod, idempotencyKeys.requestPath],
        set: {
          requestHash: input.requestHash,
          responseStatusCode: input.responseStatusCode,
          responseBody: input.responseBody,
          lockExpiresAt: input.lockExpiresAt,
          expiresAt: input.expiresAt,
          metadata: input.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }

  async removeExpired() {
    await this.db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, new Date()));
  }
}
