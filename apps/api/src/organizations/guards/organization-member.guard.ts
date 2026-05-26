import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  OrganizationMembershipsRepository,
  OrganizationsRepository,
} from '@devflow/database';

@Injectable()
export class OrganizationMemberGuard implements CanActivate {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly organizationMembershipsRepository: OrganizationMembershipsRepository,
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

    let organizationId = this.readOrganizationId(request);
    if (!organizationId) {
      const memberships =
        await this.organizationMembershipsRepository.findManyByUserId(userId);
      organizationId = memberships[0]?.organizationId ?? null;
    }

    if (!organizationId) {
      return false;
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
    const headerValue = request.headers['x-org-id'];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }

    const queryOrg = request.query.orgId ?? request.query.organizationId;
    if (typeof queryOrg === 'string' && queryOrg.length > 0) {
      return queryOrg;
    }

    const paramsOrg = (request.params as Record<string, string> | undefined)
      ?.organizationId;
    if (paramsOrg && paramsOrg.length > 0) {
      return paramsOrg;
    }

    return null;
  }
}
