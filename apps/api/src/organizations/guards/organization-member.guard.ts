import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  OrganizationMembershipsRepository,
  OrganizationsRepository,
} from '@devflow/database';
import { OrganizationService } from '../organizations.service.js';

@Injectable()
export class OrganizationMemberGuard implements CanActivate {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly organizationMembershipsRepository: OrganizationMembershipsRepository,
    private readonly organizationService: OrganizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        authSession?: { user?: { id: string } };
        orgContext?: unknown;
      }
    >();
    const userId = request.authSession?.user?.id;

    if (!userId) {
      return false;
    }

    const organizationId = this.readOrganizationId(request);
    if (!organizationId) {
      const defaultOrganization =
        await this.organizationService.resolveDefaultOrganizationForUser(
          userId,
        );

      if (!defaultOrganization) {
        return false;
      }

      request.orgContext = defaultOrganization;
      return true;
    }

    const organization =
      await this.organizationsRepository.findById(organizationId);
    if (!organization) {
      return false;
    }

    const membership =
      await this.organizationMembershipsRepository.findByOrganizationAndUser(
        organizationId,
        userId,
      );
    if (!membership || membership.status !== 'active') {
      return false;
    }

    request.orgContext = {
      organization,
      membership,
    };

    return true;
  }

  private readOrganizationId(request: Request): string | null {
    const headerValue =
      request.headers['x-org-id'] ?? request.headers['x-workspace-id'];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }

    const queryOrg =
      request.query.orgId ??
      request.query.organizationId ??
      request.query.workspaceId;
    if (typeof queryOrg === 'string' && queryOrg.length > 0) {
      return queryOrg;
    }

    const paramsOrg = (request.params as Record<string, string> | undefined)
      ?.organizationId;
    if (paramsOrg && paramsOrg.length > 0) {
      return paramsOrg;
    }

    const paramsWorkspaceId = (
      request.params as Record<string, string> | undefined
    )?.workspaceId;
    if (paramsWorkspaceId && paramsWorkspaceId.length > 0) {
      return paramsWorkspaceId;
    }

    return null;
  }
}
