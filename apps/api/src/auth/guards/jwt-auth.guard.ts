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
    const token = this.extractToken(request);

    if (!token) {
      this.logger.event('warn', 'auth.session.missing', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        hasAuthorization: Boolean(request.headers.authorization),
        hasCookieHeader: Boolean(request.headers.cookie),
      });

      throw new UnauthorizedException('Authentication required');
    }

    const session = await this.sessionService.authenticateAccessToken(token);

    if (!session) {
      this.logger.event('warn', 'auth.session.invalid', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        hasAuthorization: Boolean(request.headers.authorization),
        hasCookieHeader: Boolean(request.headers.cookie),
      });

      throw new UnauthorizedException('Invalid or expired session');
    }

    request.authSession = session;
    return true;
  }

  private extractToken(request: Request): string | null {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith(AUTH_BEARER_PREFIX)) {
      return authorization.slice(AUTH_BEARER_PREFIX.length).trim();
    }

    const cookieToken = this.readCookie(
      request.headers.cookie ?? '',
      AUTH_ACCESS_TOKEN_COOKIE,
    );
    return cookieToken ?? null;
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
