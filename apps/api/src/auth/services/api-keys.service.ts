import { Injectable } from '@nestjs/common';
import { ApiKeysRepository } from '@devflow/database';
import { createRandomToken, sha256Hex } from '../utils/crypto.js';
import type { ApiScope } from '../decorators/api-scopes.decorator.js';

const API_KEY_PREFIX = 'df_live_';

@Injectable()
export class ApiKeysService {
  constructor(private readonly apiKeysRepository: ApiKeysRepository) {}

  async createKey(input: {
    organizationId: string;
    createdByUserId?: string | null;
    name: string;
    scopes: ApiScope[];
    expiresAt?: Date | null;
  }): Promise<{ id: string; token: string; prefix: string }> {
    const rawSecret = createRandomToken(32);
    const prefix = `${API_KEY_PREFIX}${rawSecret.slice(0, 12)}`;
    const token = `${prefix}.${createRandomToken(32)}`;

    const created = await this.apiKeysRepository.createKey({
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId ?? null,
      name: input.name,
      keyPrefix: prefix,
      keyHash: sha256Hex(token),
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
      metadata: {},
    });

    return { id: created.id, token, prefix };
  }

  async verifyToken(token: string): Promise<{ apiKeyId: string; organizationId: string; scopes: ApiScope[] } | null> {
    const prefix = token.split('.')[0];

    if (!prefix || !prefix.startsWith(API_KEY_PREFIX)) {
      return null;
    }

    const apiKey = await this.apiKeysRepository.findActiveByPrefix(prefix);

    if (!apiKey || apiKey.keyHash !== sha256Hex(token)) {
      return null;
    }

    await this.apiKeysRepository.markUsed(apiKey.id);

    const scopes = Array.isArray(apiKey.scopes) ? (apiKey.scopes as ApiScope[]) : [];
    return { apiKeyId: apiKey.id, organizationId: apiKey.organizationId, scopes };
  }

  async listOrganizationKeys(organizationId: string) {
    return this.apiKeysRepository.findManyByOrganizationId(organizationId);
  }

  async revokeKey(id: string) {
    return this.apiKeysRepository.revoke(id);
  }
}
