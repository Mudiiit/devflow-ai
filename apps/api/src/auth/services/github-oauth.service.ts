import { Injectable } from '@nestjs/common';
import { serverEnv } from '@devflow/config';
import { eq, users, type DatabaseClient } from '@devflow/database';
import { normalizePrivateKey } from '../utils/crypto.js';
import type { GitHubOAuthProfile } from '../auth.types.js';
import { resolveApiOrigin } from '../../common/public-origin.js';

@Injectable()
export class GitHubOAuthService {
  private readonly callbackUrl = `${resolveApiOrigin()}/auth/github/callback`;

  private static readonly profileFetchTimeoutMs = 15_000;

  buildAuthorizationUrl(state: string, returnTo?: string): URL {
    if (!serverEnv.GITHUB_CLIENT_ID) {
      throw new Error('GITHUB_CLIENT_ID is required for GitHub OAuth login');
    }

    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', serverEnv.GITHUB_CLIENT_ID);
    url.searchParams.set('redirect_uri', this.callbackUrl);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);

    if (returnTo) {
      url.searchParams.set('return_to', returnTo);
    }

    return url;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    if (!serverEnv.GITHUB_CLIENT_ID || !serverEnv.GITHUB_CLIENT_SECRET) {
      throw new Error('GitHub OAuth client credentials are not configured');
    }

    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: serverEnv.GITHUB_CLIENT_ID,
          client_secret: serverEnv.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: this.callbackUrl,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `GitHub token exchange failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!body.access_token) {
      throw new Error(
        body.error_description ?? body.error ?? 'GitHub token exchange failed',
      );
    }

    return body.access_token;
  }

  async fetchProfile(accessToken: string): Promise<GitHubOAuthProfile> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), GitHubOAuthService.profileFetchTimeoutMs);

    try {
      console.info('auth.github.fetch_profile.before', {
        timeoutMs: GitHubOAuthService.profileFetchTimeoutMs,
        hasAccessToken: Boolean(accessToken),
      });

      const [userResponse, emailResponse] = await Promise.all([
        fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: controller.signal,
        }),
        fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: controller.signal,
        }),
      ]);

      console.info('auth.github.fetch_profile.after', {
        userStatus: userResponse.status,
        emailStatus: emailResponse.status,
        userOk: userResponse.ok,
        emailOk: emailResponse.ok,
      });

      if (!userResponse.ok) {
        const responseBody = await userResponse.text().catch(() => null);
        console.error('auth.github.fetch_profile.user_failed', {
          status: userResponse.status,
          statusText: userResponse.statusText,
          responseBody,
        });
        throw new Error(
          `GitHub profile lookup failed with status ${userResponse.status}`,
        );
      }

      console.info('auth.github.fetch_profile.user_json.before');
      const user = (await userResponse.json()) as {
        id: number;
        login: string;
        name: string | null;
        avatar_url: string | null;
        node_id: string;
        company: string | null;
        bio: string | null;
        email: string | null;
      };
      console.info('auth.github.fetch_profile.user_json.after', {
        login: user.login,
        hasEmail: Boolean(user.email),
      });

      let email = user.email;

      if (!emailResponse.ok || !email) {
        const responseBody = await emailResponse.clone().text().catch(() => null);
        console.info('auth.github.fetch_profile.emails_fallback', {
          status: emailResponse.status,
          statusText: emailResponse.statusText,
          responseBody,
          hasExistingEmail: Boolean(email),
        });

        const emails = (await emailResponse.json().catch(() => [])) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        email =
          emails.find((entry) => entry.primary && entry.verified)?.email ??
          `${user.login}@users.noreply.github.com`;
      }

      return {
        githubUserId: user.id,
        login: user.login,
        name: user.name,
        email,
        avatarUrl: user.avatar_url,
        githubNodeId: user.node_id,
        company: user.company,
        bio: user.bio,
      };
    } catch (error) {
      console.error('auth.github.fetch_profile.error', {
        hasAccessToken: Boolean(accessToken),
        error,
      });
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async upsertUser(db: DatabaseClient, profile: GitHubOAuthProfile) {
    const existingRows = await db
      .select()
      .from(users)
      .where(eq(users.githubUserId, profile.githubUserId))
      .limit(1);
    const now = new Date();
    const payload = {
      email: profile.email,
      githubUserId: profile.githubUserId,
      githubLogin: profile.login,
      displayName: profile.name ?? profile.login,
      fullName: profile.name,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      role: 'member' as const,
      status: 'active' as const,
      lastLoginAt: now,
      updatedAt: now,
      metadata: {
        githubNodeId: profile.githubNodeId,
        company: profile.company,
      },
    };

    if (existingRows[0]) {
      const rows = await db
        .update(users)
        .set(payload)
        .where(eq(users.id, existingRows[0].id))
        .returning();

      return rows[0];
    }

    const rows = await db
      .insert(users)
      .values(payload)
      .onConflictDoUpdate({
        target: users.githubUserId,
        set: payload,
      })
      .returning();

    return rows[0];
  }
}
