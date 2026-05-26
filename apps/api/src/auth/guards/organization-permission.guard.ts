import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
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
  constructor(private readonly reflector: Reflector) {}

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
      return false;
    }

    return requiredPermissions.every((permission) =>
      hasPermission(membership.role!, permission),
    );
  }
}
