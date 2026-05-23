import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AUTH_ACCESS_TOKEN_COOKIE, AUTH_BEARER_PREFIX } from '../auth.constants.js';
import { SessionService } from '../services/session.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { authSession?: unknown }>();
    const token = this.extractToken(request);

    if (!token) {
      return false;
    }

    const session = await this.sessionService.authenticateAccessToken(token);

    if (!session) {
      return false;
    }

    request.authSession = session;
    return true;
  }

  private extractToken(request: Request): string | null {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith(AUTH_BEARER_PREFIX)) {
      return authorization.slice(AUTH_BEARER_PREFIX.length).trim();
    }

    const cookieToken = this.readCookie(request.headers.cookie ?? '', AUTH_ACCESS_TOKEN_COOKIE);
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