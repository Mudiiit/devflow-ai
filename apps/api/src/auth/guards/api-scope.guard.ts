import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { API_SCOPES_KEY, type ApiScope } from '../decorators/api-scopes.decorator.js';

@Injectable()
export class ApiScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<ApiScope[]>(API_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { apiAuth?: { scopes?: string[] } }>();
    const scopes = new Set(request.apiAuth?.scopes ?? []);
    return requiredScopes.every((scope) => scopes.has(scope));
  }
}
