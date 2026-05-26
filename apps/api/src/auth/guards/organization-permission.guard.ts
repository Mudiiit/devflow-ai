import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { StructuredLoggerService } from '@devflow/logger';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import {
  hasPermission,
  type AppPermission,
  type AppRole,
} from '../rbac.types.js';

type OrganizationContext = {
  membership?: {
    role?: AppRole;
    status?: string;
  };
};

@Injectable()
export class OrganizationPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: StructuredLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      AppPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { orgContext?: OrganizationContext }>();
    const membership = request.orgContext?.membership;

    if (!membership || membership.status !== 'active' || !membership.role) {
      this.logger.event('warn', 'organization.permission.missing', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        hasMembership: Boolean(membership),
        membershipStatus: membership?.status ?? null,
        role: membership?.role ?? null,
        requiredPermissions,
      });

      throw new ForbiddenException('Organization permission required');
    }

    const allowed = requiredPermissions.every((permission) =>
      hasPermission(membership.role!, permission),
    );

    if (!allowed) {
      this.logger.event('warn', 'organization.permission.denied', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        role: membership.role,
        requiredPermissions,
      });

      throw new ForbiddenException('Organization permission denied');
    }

    return true;
  }
}
