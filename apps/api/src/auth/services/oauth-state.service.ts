import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, oauthStates, type DatabaseClient } from '@devflow/database';
import { AUTH_OAUTH_STATE_TTL_SECONDS } from '../auth.constants.js';
import { createRandomToken, sha256Hex } from '../utils/crypto.js';
import { DATABASE_CLIENT } from '../../database/database.constants.js';
import { resolveFrontendOrigin } from '../../common/public-origin.js';

@Injectable()
export class OauthStateService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async createState(returnTo?: string): Promise<{ state: string }> {
    const state = createRandomToken(32);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AUTH_OAUTH_STATE_TTL_SECONDS * 1000);

    await this.db.insert(oauthStates).values({
      provider: 'github',
      stateHash: sha256Hex(state),
      returnTo: returnTo ?? resolveFrontendOrigin(),
      expiresAt,
    });

    return { state };
  }

  async consumeState(state: string): Promise<string | null> {
    const stateHash = sha256Hex(state);
    const rows = await this.db
      .select()
      .from(oauthStates)
      .where(and(eq(oauthStates.stateHash, stateHash), isNull(oauthStates.consumedAt), gt(oauthStates.expiresAt, new Date())))
      .limit(1);

    const record = rows[0];

    if (!record) {
      return null;
    }

    await this.db
      .update(oauthStates)
      .set({ consumedAt: new Date(), updatedAt: new Date() })
      .where(eq(oauthStates.id, record.id));

    return record.returnTo ?? null;
  }
}