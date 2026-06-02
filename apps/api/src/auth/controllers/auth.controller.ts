import {
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DATABASE_CLIENT } from '../../database/database.constants.js';
import type { DatabaseClient } from '@devflow/database';
import {
  AUTH_ACCESS_TOKEN_COOKIE,
  AUTH_CSRF_COOKIE,
  AUTH_COOKIE_PATH,
  AUTH_REFRESH_TOKEN_COOKIE,
  resolveAuthCookieSameSite,
} from '../auth.constants.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { RateLimit } from '../decorators/rate-limit.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { CsrfGuard } from '../guards/csrf.guard.js';
import { RateLimitGuard } from '../guards/rate-limit.guard.js';
import { AuthSessionInterceptor } from '../interceptors/auth-session.interceptor.js';
import { GitHubOAuthStrategy } from '../strategies/github-oauth.strategy.js';
import { OauthStateService } from '../services/oauth-state.service.js';
import { SessionService } from '../services/session.service.js';
import { GitHubOAuthService } from '../services/github-oauth.service.js';
import { OrganizationService } from '../../organizations/organizations.service.js';
import {
  isSecureFrontendOrigin,
  resolveFrontendOrigin,
  resolveSharedCookieDomain,
} from '../../common/public-origin.js';

@Controller('auth')
@UseInterceptors(AuthSessionInterceptor)
export class AuthController {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly oauthStateService: OauthStateService,
    private readonly githubOAuthStrategy: GitHubOAuthStrategy,
    private readonly githubOAuthService: GitHubOAuthService,
    private readonly sessionService: SessionService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Get('github/login')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async login(
    @Query('returnTo') returnTo: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const { state } = await this.withTimeout(
        this.oauthStateService.createState(returnTo),
        5000,
        'oauth state creation',
      );
      const url = this.githubOAuthStrategy.buildAuthorizationUrl(
        state,
        returnTo,
      );
      response.redirect(url.toString());
      return;
    } catch (error) {
      response
        .status(
          error instanceof Error && error.message.includes('timed out')
            ? 504
            : 500,
        )
        .json({ message: 'GitHub login is temporarily unavailable' });
      return;
    }
  }

  @Get('github/callback')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Res() response: Response,
    @Req() request: Request,
  ): Promise<void> {
    if (!code || !state) {
      response
        .status(400)
        .json({ message: 'Missing GitHub OAuth code or state' });
      return;
    }

    try {
      const returnTo =
        (await this.oauthStateService.consumeState(state)) ??
        resolveFrontendOrigin();
      const accessToken =
        await this.githubOAuthStrategy.exchangeCodeForToken(code);
      const profile = await this.githubOAuthStrategy.fetchProfile(accessToken);
      const session = await this.issueGitHubSession(profile, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      this.setAuthCookies(
        response,
        session.accessToken,
        session.refreshToken,
        session.csrfToken,
      );

      console.info('auth.callback.cookies.set', {
        requestUrl: request.originalUrl ?? request.url,
        returnTo,
        cookieOptions: {
          httpOnly: true,
          secure: this.isSecureCookiesEnabled(),
          sameSite: resolveAuthCookieSameSite(),
          path: AUTH_COOKIE_PATH,
          ...(resolveSharedCookieDomain()
            ? { domain: resolveSharedCookieDomain() }
            : {}),
        },
        cookieNames: [
          AUTH_ACCESS_TOKEN_COOKIE,
          AUTH_REFRESH_TOKEN_COOKIE,
          AUTH_CSRF_COOKIE,
        ],
        setCookieHeaders: response.getHeader('Set-Cookie') ?? response.getHeader('set-cookie') ?? null,
      });

      response.redirect(returnTo);
    } catch (error) {
      response.status(500).json({ message: 'GitHub OAuth callback failed' });
    }
  }

  @Post('github/bootstrap')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  async bootstrapGitHubSession(@Req() request: Request) {
    console.info('auth.bootstrap.start', {
      requestUrl: request.originalUrl ?? request.url,
      hasAuthorization: Boolean(request.headers.authorization),
      hasCookieHeader: Boolean(request.headers.cookie),
      hasGithubClientId: Boolean(process.env.GITHUB_CLIENT_ID),
      hasGithubClientSecret: Boolean(process.env.GITHUB_CLIENT_SECRET),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    });

    const authorization = request.headers.authorization ?? '';
    const accessToken = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';

    if (!accessToken) {
      console.error('auth.bootstrap.missing_github_session_token', {
        requestUrl: request.originalUrl ?? request.url,
      });
      throw new UnauthorizedException('Missing GitHub access token');
    }

    try {
      console.info('auth.bootstrap.fetch_profile.before', {
        requestUrl: request.originalUrl ?? request.url,
      });
      const profile = await this.githubOAuthService.fetchProfile(accessToken);
      console.info('auth.bootstrap.fetch_profile.after', {
        requestUrl: request.originalUrl ?? request.url,
        githubUserId: profile.githubUserId,
        login: profile.login,
        hasEmail: Boolean(profile.email),
      });

      console.info('auth.bootstrap.issue_session.before', {
        requestUrl: request.originalUrl ?? request.url,
        githubUserId: profile.githubUserId,
        login: profile.login,
      });
      const session = await this.issueGitHubSession(profile, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
      console.info('auth.bootstrap.issue_session.after', {
        requestUrl: request.originalUrl ?? request.url,
        githubUserId: profile.githubUserId,
        sessionId: session.sessionId,
      });

      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        csrfToken: session.csrfToken,
        sessionId: session.sessionId,
      };
    } catch (error) {
      console.error('auth.bootstrap.failed', {
        requestUrl: request.originalUrl ?? request.url,
        error,
      });
      throw error;
    }
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  async session(@CurrentUser() user: unknown, @Req() request: Request) {
    return {
      user,
      session:
        (request as Request & { authSession?: { session?: unknown } })
          .authSession?.session ?? null,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async currentUser(@CurrentUser() user: unknown) {
    return { user };
  }

  @Post('refresh')
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  async refresh(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const refreshToken = this.readCookie(
      request.headers.cookie ?? '',
      AUTH_REFRESH_TOKEN_COOKIE,
    );
    const csrfToken = this.readCookie(
      request.headers.cookie ?? '',
      AUTH_CSRF_COOKIE,
    );

    if (!refreshToken || !csrfToken) {
      response.status(401).json({ message: 'Missing refresh session cookies' });
      return;
    }

    const result = await this.sessionService.refreshSession(
      refreshToken,
      csrfToken,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      },
    );

    if (!result) {
      response.status(401).json({ message: 'Invalid refresh session' });
      return;
    }

    this.setAuthCookies(
      response,
      result.accessToken,
      result.refreshToken,
      result.csrfToken,
    );
    response.json({
      user: result.session.user,
      sessionId: result.session.session.id,
    });
  }

  @Post('logout')
  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60_000 })
  async logout(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const refreshToken = this.readCookie(
      request.headers.cookie ?? '',
      AUTH_REFRESH_TOKEN_COOKIE,
    );

    if (refreshToken) {
      await this.sessionService.revokeSessionByRefreshToken(refreshToken);
    }

    this.clearAuthCookies(response);
    response.status(204).send();
  }

  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
    csrfToken: string,
  ): void {
    const sharedCookieDomain = resolveSharedCookieDomain();
    const cookieBase = {
      httpOnly: true,
      secure: this.isSecureCookiesEnabled(),
      sameSite: resolveAuthCookieSameSite(),
      path: AUTH_COOKIE_PATH,
      ...(sharedCookieDomain ? { domain: sharedCookieDomain } : {}),
    } as const;

    response.cookie(AUTH_ACCESS_TOKEN_COOKIE, accessToken, {
      ...cookieBase,
      maxAge: 15 * 60 * 1000,
    });
    response.cookie(AUTH_REFRESH_TOKEN_COOKIE, refreshToken, {
      ...cookieBase,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    response.cookie(AUTH_CSRF_COOKIE, csrfToken, {
      secure: this.isSecureCookiesEnabled(),
      sameSite: resolveAuthCookieSameSite(),
      path: AUTH_COOKIE_PATH,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(response: Response): void {
    const sharedCookieDomain = resolveSharedCookieDomain();
    const cookieOptions = {
      path: AUTH_COOKIE_PATH,
      ...(sharedCookieDomain ? { domain: sharedCookieDomain } : {}),
    } as const;

    response.clearCookie(AUTH_ACCESS_TOKEN_COOKIE, cookieOptions);
    response.clearCookie(AUTH_REFRESH_TOKEN_COOKIE, cookieOptions);
    response.clearCookie(AUTH_CSRF_COOKIE, cookieOptions);
  }

  private async issueGitHubSession(
    profile: Awaited<ReturnType<GitHubOAuthService['fetchProfile']>>,
    context: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
    sessionId: string;
  }> {
    console.info('auth.bootstrap.upsert_user.before', {
      githubUserId: profile.githubUserId,
      login: profile.login,
    });

    const dbUser = await this.githubOAuthService.upsertUser(this.db, profile);

    console.info('auth.bootstrap.upsert_user.after', {
      userId: dbUser.id,
      githubLogin: dbUser.githubLogin,
    });

    console.info('auth.bootstrap.organization.before', {
      userId: dbUser.id,
    });

    await this.organizationService.ensurePersonalOrganizationForUser({
      userId: dbUser.id,
      githubLogin: dbUser.githubLogin,
      displayName: dbUser.displayName,
    });

    console.info('auth.bootstrap.organization.after', {
      userId: dbUser.id,
    });

    console.info('auth.bootstrap.session.before', {
      userId: dbUser.id,
    });

    const session = await this.sessionService.issueSession(
      {
        id: dbUser.id,
        email: dbUser.email,
        githubUserId: Number(dbUser.githubUserId),
        githubLogin: dbUser.githubLogin,
        displayName: dbUser.displayName,
        fullName: dbUser.fullName,
        avatarUrl: dbUser.avatarUrl,
        role: dbUser.role,
        status: dbUser.status,
      },
      context,
    );

    console.info('auth.bootstrap.session.after', {
      userId: dbUser.id,
      sessionId: session.sessionId,
    });

    return session;
  }

  private readCookie(cookieHeader: string, name: string): string | null {
    for (const segment of cookieHeader.split(';')) {
      const [rawName, ...rawValue] = segment.trim().split('=');
      if (rawName === name) {
        return decodeURIComponent(rawValue.join('='));
      }
    }

    return null;
  }

  private isSecureCookiesEnabled(): boolean {
    return isSecureFrontendOrigin();
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    let timedOut = false;

    try {
      const guardedPromise = promise.then(
        (value) => value,
        (error) => {
          if (timedOut) {
            console.warn(
              '[api] %s rejected after timeout: %s',
              label,
              error instanceof Error ? error.message : String(error),
            );
            return undefined as T;
          }

          throw error;
        },
      );

      return await Promise.race([
        guardedPromise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
