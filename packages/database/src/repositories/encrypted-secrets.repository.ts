import { and, eq, isNull } from 'drizzle-orm';
import { encryptedSecrets } from '../schema/encrypted-secrets.js';
import type { DatabaseClient } from '../client/index.js';
import type { NewEncryptedSecret } from '../schema/encrypted-secrets.js';
import { BaseRepository } from './base.repository.js';

export class EncryptedSecretsRepository extends BaseRepository<typeof encryptedSecrets> {
  constructor(db: DatabaseClient) {
    super(db, encryptedSecrets, encryptedSecrets.id);
  }

  async findByScopedKey(organizationId: string, repositoryId: string | null, key: string) {
    const whereClause = repositoryId
      ? and(
          eq(encryptedSecrets.organizationId, organizationId),
          eq(encryptedSecrets.repositoryId, repositoryId),
          eq(encryptedSecrets.key, key),
        )
      : and(
          eq(encryptedSecrets.organizationId, organizationId),
          isNull(encryptedSecrets.repositoryId),
          eq(encryptedSecrets.key, key),
        );

    const rows = await this.db.select().from(encryptedSecrets).where(whereClause).limit(1);
    return rows[0] ?? null;
  }

  async upsertScopedSecret(input: NewEncryptedSecret) {
    const rows = await this.db
      .insert(encryptedSecrets)
      .values(input)
      .onConflictDoUpdate({
        target: [encryptedSecrets.organizationId, encryptedSecrets.repositoryId, encryptedSecrets.key],
        set: {
          algorithm: input.algorithm,
          encryptedValue: input.encryptedValue,
          iv: input.iv,
          authTag: input.authTag,
          version: input.version,
          rotatedAt: new Date(),
          metadata: input.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0]!;
  }
}
