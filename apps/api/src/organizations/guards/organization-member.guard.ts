import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { StructuredLoggerService } from '@devflow/logger';
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
    private readonly logger: StructuredLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        authSession?: { user?: { id: string } };
        orgContext?: unknown;
      }
    >();
    const userId = request.authSession?.user?.id;
    const organizationContext = this.readOrganizationContext(request);

    if (!userId) {
      this.logger.event('warn', 'organization.context.missing_user', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        organizationId: organizationContext.organizationId,
        workspaceId: organizationContext.workspaceId,
      });

      throw new UnauthorizedException('Authentication required');
    }

    const organizationId = organizationContext.organizationId;
    if (!organizationId) {
      const defaultOrganization =
        await this.organizationService.resolveDefaultOrganizationForUser(
          userId,
        );

      if (!defaultOrganization) {
        const dashboardFallbackAllowed = this.isDashboardFallbackRoute(request);
        this.logger.event('warn', 'organization.context.missing', {
          path: request.originalUrl ?? request.url,
          method: request.method,
          userId,
          organizationId: null,
          workspaceId: organizationContext.workspaceId,
          resolutionSource: organizationContext.source,
          guardOutcome: dashboardFallbackAllowed ? 'allowed_empty' : 'denied',
        });

        if (dashboardFallbackAllowed) {
          request.orgContext = {
            organization: null,
            membership: null,
          };

          return true;
        }

        throw new ForbiddenException('Active organization required');
      }

      this.logger.event('info', 'organization.context.resolved', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        userId,
        organizationId: defaultOrganization.organization.id,
        workspaceId: defaultOrganization.organization.id,
        resolutionSource: 'default',
      });

      request.orgContext = defaultOrganization;
      return true;
    }

    const organization =
      await this.organizationsRepository.findById(organizationId);
    if (!organization) {
      this.logger.event('warn', 'organization.context.invalid', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        userId,
        organizationId,
        workspaceId: organizationContext.workspaceId,
        resolutionSource: organizationContext.source,
      });

      throw new ForbiddenException('Organization not found');
    }

    const membership =
      await this.organizationMembershipsRepository.findByOrganizationAndUser(
        organizationId,
        userId,
      );
    if (!membership || membership.status !== 'active') {
      this.logger.event('warn', 'organization.membership.missing', {
        path: request.originalUrl ?? request.url,
        method: request.method,
        userId,
        organizationId,
        membershipStatus: membership?.status ?? null,
        workspaceId: organizationContext.workspaceId,
        resolutionSource: organizationContext.source,
      });

      throw new ForbiddenException('Organization access denied');
    }

    this.logger.event('info', 'organization.context.resolved', {
      path: request.originalUrl ?? request.url,
      method: request.method,
      userId,
      organizationId,
      workspaceId: organizationContext.workspaceId,
      resolutionSource: organizationContext.source,
    });

    request.orgContext = {
      organization,
      membership,
    };

    return true;
  }

  private readOrganizationContext(request: Request): {
    organizationId: string | null;
    workspaceId: string | null;
    source:
      | 'header:x-org-id'
      | 'header:x-workspace-id'
      | 'query:orgId'
      | 'query:organizationId'
      | 'query:workspaceId'
      | 'param:organizationId'
      | 'param:workspaceId'
      | 'missing';
  } {
    const headerValue =
      request.headers['x-org-id'] ?? request.headers['x-workspace-id'];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return {
        organizationId: headerValue,
        workspaceId: headerValue,
        source: request.headers['x-org-id']
          ? 'header:x-org-id'
          : 'header:x-workspace-id',
      };
    }

    const queryOrg =
      request.query.orgId ??
      request.query.organizationId ??
      request.query.workspaceId;
    if (typeof queryOrg === 'string' && queryOrg.length > 0) {
      return {
        organizationId: queryOrg,
        workspaceId: queryOrg,
        source: request.query.orgId
          ? 'query:orgId'
          : request.query.organizationId
            ? 'query:organizationId'
            : 'query:workspaceId',
      };
    }

    const paramsOrg = (request.params as Record<string, string> | undefined)
      ?.organizationId;
    if (paramsOrg && paramsOrg.length > 0) {
      return {
        organizationId: paramsOrg,
        workspaceId: paramsOrg,
        source: 'param:organizationId',
      };
    }

    const paramsWorkspaceId = (
      request.params as Record<string, string> | undefined
    )?.workspaceId;
    if (paramsWorkspaceId && paramsWorkspaceId.length > 0) {
      return {
        organizationId: paramsWorkspaceId,
        workspaceId: paramsWorkspaceId,
        source: 'param:workspaceId',
      };
    }

    return {
      organizationId: null,
      workspaceId: null,
      source: 'missing',
    };
  }

  private isDashboardFallbackRoute(request: Request): boolean {
    const path = request.originalUrl ?? request.url;
    return request.method === 'GET' && (
      path === '/dashboard/overview' ||
      path === '/dashboard/repositories' ||
      path.startsWith('/dashboard/overview?') ||
      path.startsWith('/dashboard/repositories?')
    );
  }
}
