import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StructuredLoggerService } from '@devflow/logger';
import {
  AUTH_ACCESS_TOKEN_COOKIE,
  AUTH_BEARER_PREFIX,
} from '../auth.constants.js';
import { SessionService } from '../services/session.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { authSession?: unknown }>();
    const tokenDetails = this.extractToken(request);

    if (!tokenDetails.token) {
      this.logger.event('warn', 'auth.session.missing', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        hasAuthorization: Boolean(request.headers.authorization),
        hasCookieHeader: Boolean(request.headers.cookie),
        tokenPresent: false,
        tokenSource: tokenDetails.source,
      });

      throw new UnauthorizedException('Authentication required');
    }

    const session = await this.sessionService.authenticateAccessToken(
      tokenDetails.token,
    );

    if (!session) {
      this.logger.event('warn', 'auth.session.invalid', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        hasAuthorization: Boolean(request.headers.authorization),
        hasCookieHeader: Boolean(request.headers.cookie),
        tokenPresent: true,
        tokenSource: tokenDetails.source,
      });

      throw new UnauthorizedException('Invalid or expired session');
    }

    this.logger.event('info', 'auth.session.valid', {
      path: request.originalUrl ?? request.url,
      method: request.method,
      userId: session.user.id,
      sessionId: session.session.id,
      hasAuthorization: Boolean(request.headers.authorization),
      hasCookieHeader: Boolean(request.headers.cookie),
      tokenPresent: true,
      tokenSource: tokenDetails.source,
    });

    request.authSession = session;
    return true;
  }

  private extractToken(request: Request): {
    token: string | null;
    source: 'authorization' | 'cookie' | 'missing';
  } {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith(AUTH_BEARER_PREFIX)) {
      return {
        token: authorization.slice(AUTH_BEARER_PREFIX.length).trim(),
        source: 'authorization',
      };
    }

    const cookieToken = this.readCookie(
      request.headers.cookie ?? '',
      AUTH_ACCESS_TOKEN_COOKIE,
    );
    return {
      token: cookieToken ?? null,
      source: cookieToken ? 'cookie' : 'missing',
    };
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
}
