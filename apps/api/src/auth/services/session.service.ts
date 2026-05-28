import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  authSessions,
  eq,
  gt,
  isNull,
  users,
  type DatabaseClient,
} from '@devflow/database';
import { AUTH_REFRESH_TOKEN_TTL_SECONDS } from '../auth.constants.js';
import type {
  AuthenticatedUser,
  RequestSessionContext,
} from '../auth.types.js';
import { createRandomToken, sha256Hex } from '../utils/crypto.js';
import { JwtService } from './jwt.service.js';
import { DATABASE_CLIENT } from '../../database/database.constants.js';

export interface SessionClientContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly jwtService: JwtService,
  ) {}

  async issueSession(
    user: AuthenticatedUser,
    context: SessionClientContext = {},
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
    sessionId: string;
    expiresAt: Date;
  }> {
    const refreshToken = createRandomToken(48);
    const csrfToken = createRandomToken(24);
    const expiresAt = new Date(
      Date.now() + AUTH_REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    console.info('auth.session.issue.before', {
      userId: user.id,
      userEmail: user.email,
      githubLogin: user.githubLogin,
      hasIpAddress: Boolean(context.ipAddress),
      hasUserAgent: Boolean(context.userAgent),
    });

    let rows;

    try {
      rows = await this.db
        .insert(authSessions)
        .values({
          userId: user.id,
          refreshTokenHash: sha256Hex(refreshToken),
          csrfTokenHash: sha256Hex(csrfToken),
          expiresAt,
          userAgent: context.userAgent ?? undefined,
          ipAddress: context.ipAddress ?? undefined,
          metadata: { issuedVia: 'github-oauth' },
        })
        .returning();
    } catch (error) {
      console.error('auth.session.issue.insert_failed', {
        userId: user.id,
        error,
      });
      throw error;
    }

    const session = rows[0];

    let accessToken: string;
    try {
      console.info('auth.session.issue.signing.before', {
        sessionId: session.id,
        userId: user.id,
      });
      accessToken = this.jwtService.signAccessToken({
        sub: user.id,
        sid: session.id,
        role: user.role,
        email: user.email,
        githubLogin: user.githubLogin,
      });
      console.info('auth.session.issue.signing.after', {
        sessionId: session.id,
        userId: user.id,
        accessTokenLength: accessToken.length,
      });
    } catch (error) {
      console.error('auth.session.issue.signing_failed', {
        sessionId: session.id,
        userId: user.id,
        error,
      });
      throw error;
    }

    return {
      accessToken,
      refreshToken,
      csrfToken,
      sessionId: session.id,
      expiresAt,
    };
  }

  async refreshSession(
    refreshToken: string,
    csrfToken: string,
    context: SessionClientContext = {},
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
    session: RequestSessionContext;
  } | null> {
    const tokenHash = sha256Hex(refreshToken);
    const rows = await this.db
      .select({ session: authSessions, user: users })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(
        and(
          eq(authSessions.refreshTokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const row = rows[0];

    if (!row || row.session.csrfTokenHash !== sha256Hex(csrfToken)) {
      return null;
    }

    const nextRefreshToken = createRandomToken(48);
    const nextCsrfToken = createRandomToken(24);
    await this.db
      .update(authSessions)
      .set({
        refreshTokenHash: sha256Hex(nextRefreshToken),
        csrfTokenHash: sha256Hex(nextCsrfToken),
        lastUsedAt: new Date(),
        userAgent: context.userAgent ?? row.session.userAgent,
        ipAddress: context.ipAddress ?? row.session.ipAddress,
        updatedAt: new Date(),
      })
      .where(eq(authSessions.id, row.session.id));

    const user = this.toAuthenticatedUser(row.user);
    const accessToken = this.jwtService.signAccessToken({
      sub: user.id,
      sid: row.session.id,
      role: user.role,
      email: user.email,
      githubLogin: user.githubLogin,
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      csrfToken: nextCsrfToken,
      session: { session: row.session, user },
    };
  }

  async revokeSessionByRefreshToken(refreshToken: string): Promise<boolean> {
    const tokenHash = sha256Hex(refreshToken);
    const rows = await this.db
      .update(authSessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(authSessions.refreshTokenHash, tokenHash))
      .returning({ id: authSessions.id });

    return rows.length > 0;
  }

  async authenticateAccessToken(
    accessToken: string,
  ): Promise<RequestSessionContext | null> {
    const payload = this.jwtService.verifyAccessToken(accessToken);

    if (!payload) {
      return null;
    }

    const rows = await this.db
      .select({ session: authSessions, user: users })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(
        and(
          eq(authSessions.id, payload.sid),
          eq(authSessions.userId, payload.sub),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const row = rows[0];

    if (!row) {
      return null;
    }

    return { session: row.session, user: this.toAuthenticatedUser(row.user) };
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(authSessions.id, sessionId));
  }

  private toAuthenticatedUser(
    user: typeof users.$inferSelect,
  ): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      githubUserId: Number(user.githubUserId),
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    };
  }
}
