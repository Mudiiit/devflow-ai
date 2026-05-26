import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  eq,
  gt,
  isNull,
  oauthStates,
  type DatabaseClient,
} from '@devflow/database';
import { AUTH_OAUTH_STATE_TTL_SECONDS } from '../auth.constants.js';
import { createRandomToken, sha256Hex } from '../utils/crypto.js';
import { DATABASE_CLIENT } from '../../database/database.constants.js';
import { resolveFrontendOrigin } from '../../common/public-origin.js';

@Injectable()
export class OauthStateService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  async createState(returnTo?: string): Promise<{ state: string }> {
    const state = createRandomToken(32);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + AUTH_OAUTH_STATE_TTL_SECONDS * 1000,
    );
    const persistedReturnTo = returnTo ?? resolveFrontendOrigin();

    await this.runWithTimeout(
      this.db.insert(oauthStates).values({
        provider: 'github',
        stateHash: sha256Hex(state),
        returnTo: persistedReturnTo,
        expiresAt,
      }),
      3000,
      'oauth state insert',
    );

    return { state };
  }

  async consumeState(state: string | null | undefined): Promise<string | null> {
    if (typeof state !== 'string' || state.trim().length === 0) {
      return null;
    }

    const stateHash = sha256Hex(state);
    const rows = await this.db
      .select()
      .from(oauthStates)
      .where(
        and(
          eq(oauthStates.stateHash, stateHash),
          isNull(oauthStates.consumedAt),
          gt(oauthStates.expiresAt, new Date()),
        ),
      )
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
