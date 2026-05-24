import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { OrganizationMemberGuard } from '../../organizations/guards/organization-member.guard.js';
import { OrganizationPermissionGuard } from '../guards/organization-permission.guard.js';
import { CurrentOrganization } from '../../organizations/decorators/current-organization.decorator.js';
import { Permissions } from '../decorators/permissions.decorator.js';
import type { ApiScope } from '../decorators/api-scopes.decorator.js';
import { ApiKeysService } from '../services/api-keys.service.js';
import { AuditTrailService } from '../../security/services/audit-trail.service.js';

@Controller('auth/api-keys')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, OrganizationPermissionGuard)
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  @Get()
  @Permissions('api_keys.manage')
  async listKeys(@CurrentOrganization() organization: { id: string }) {
    const keys = await this.apiKeysService.listOrganizationKeys(organization.id);
    return {
      keys: keys.map((entry) => ({
        id: entry.id,
        name: entry.name,
        keyPrefix: entry.keyPrefix,
        scopes: entry.scopes,
        createdAt: entry.createdAt,
        lastUsedAt: entry.lastUsedAt,
        expiresAt: entry.expiresAt,
        revokedAt: entry.revokedAt,
      })),
    };
  }

  @Post()
  @Permissions('api_keys.manage')
  async createKey(
    @CurrentOrganization() organization: { id: string },
    @CurrentUser() user: { id: string },
    @Body() body: { name: string; scopes?: ApiScope[]; expiresAt?: string },
    @Req() request: Request & { requestId?: string },
  ) {
    const created = await this.apiKeysService.createKey({
      organizationId: organization.id,
      createdByUserId: user.id,
      name: body.name,
      scopes: body.scopes ?? ['reviews:read'],
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });

    await this.auditTrailService.record({
      actorUserId: user.id,
      organizationId: organization.id,
      action: 'api_key',
      entityType: 'api_key',
      entityId: created.id,
      requestId: request.requestId ?? null,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      metadata: {
        scopeCount: body.scopes?.length ?? 1,
      },
    });

    return {
      apiKey: {
        id: created.id,
        prefix: created.prefix,
      },
      token: created.token,
    };
  }

  @Delete(':id')
  @Permissions('api_keys.manage')
  async revokeKey(
    @Param('id') id: string,
    @CurrentOrganization() organization: { id: string },
    @CurrentUser() user: { id: string },
    @Req() request: Request & { requestId?: string },
  ) {
    const revoked = await this.apiKeysService.revokeKey(id);

    if (revoked) {
      await this.auditTrailService.record({
        actorUserId: user.id,
        organizationId: organization.id,
        action: 'api_key',
        entityType: 'api_key',
        entityId: id,
        requestId: request.requestId ?? null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        metadata: {
          operation: 'revoke',
        },
      });
    }

    return {
      revoked: Boolean(revoked),
    };
  }
}
