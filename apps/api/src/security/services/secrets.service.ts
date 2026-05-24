import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EncryptedSecretsRepository } from '@devflow/database';
import { serverEnv } from '@devflow/config';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class SecretsService {
  constructor(private readonly encryptedSecretsRepository: EncryptedSecretsRepository) {}

  async setSecret(input: {
    organizationId: string;
    repositoryId?: string | null;
    key: string;
    value: string;
    createdByUserId?: string | null;
  }) {
    const encrypted = this.encrypt(input.value);

    return this.encryptedSecretsRepository.upsertScopedSecret({
      organizationId: input.organizationId,
      repositoryId: input.repositoryId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      key: input.key,
      algorithm: ALGORITHM,
      encryptedValue: encrypted.cipherText,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      version: 'v1',
      rotatedAt: new Date(),
      metadata: {},
    });
  }

  async getSecret(input: { organizationId: string; repositoryId?: string | null; key: string }): Promise<string | null> {
    const scoped = await this.encryptedSecretsRepository.findByScopedKey(input.organizationId, input.repositoryId ?? null, input.key);
    const fallback = scoped ?? (input.repositoryId ? await this.encryptedSecretsRepository.findByScopedKey(input.organizationId, null, input.key) : null);

    if (!fallback) {
      return null;
    }

    return this.decrypt({
      cipherText: fallback.encryptedValue,
      iv: fallback.iv,
      authTag: fallback.authTag,
    });
  }

  private encrypt(value: string): { cipherText: string; iv: string; authTag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.resolveKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      cipherText: encrypted.toString('base64'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  private decrypt(input: { cipherText: string; iv: string; authTag: string }): string {
    const decipher = createDecipheriv(ALGORITHM, this.resolveKey(), Buffer.from(input.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(input.authTag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(input.cipherText, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private resolveKey(): Buffer {
    const source = serverEnv.SECRET_ENCRYPTION_KEY ?? serverEnv.JWT_SECRET;
    return createHash('sha256').update(source).digest();
  }
}
