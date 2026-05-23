import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AUTH_CSRF_COOKIE, AUTH_CSRF_HEADER } from '../auth.constants.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const headerToken = request.headers[AUTH_CSRF_HEADER] as string | undefined;
    const cookieToken = this.readCookie(
      request.headers.cookie ?? '',
      AUTH_CSRF_COOKIE,
    );

    return Boolean(headerToken && cookieToken && headerToken === cookieToken);
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