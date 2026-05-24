import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizationPermissionGuard } from '../auth/guards/organization-permission.guard.js';
import { OrganizationService } from './organizations.service.js';
import { OrganizationMemberGuard } from './guards/organization-member.guard.js';
import { CurrentOrganization } from './decorators/current-organization.decorator.js';
import type { User } from '@devflow/database';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  async listOrganizations(@CurrentUser() user: { id: string }) {
    const organizations = await this.organizationService.listOrganizationsForUser(user.id);
    return {
      userId: user.id,
      organizations,
    };
  }

  @Get('default')
  async getDefaultOrganization(@CurrentUser() user: { id: string }) {
    const organizations = await this.organizationService.listOrganizationsForUser(user.id);
    return {
      organization: organizations[0]?.organization ?? null,
      membership: organizations[0]?.membership ?? null,
    };
  }

  @Get(':organizationId')
  @UseGuards(OrganizationMemberGuard)
  async getOrganization(@CurrentOrganization() organization: unknown) {
    return { organization };
  }

  @Get(':organizationId/members')
  @UseGuards(OrganizationMemberGuard, OrganizationPermissionGuard)
  @Permissions('organization.members.manage')
  async getOrganizationMembers(@Param('organizationId') organizationId: string) {
    const members = await this.organizationService.listOrganizationMembers(organizationId);
    return { organizationId, members };
  }

  @Post(':organizationId/members')
  @UseGuards(OrganizationMemberGuard, OrganizationPermissionGuard)
  @Permissions('organization.members.manage')
  async addOrganizationMember(
    @Param('organizationId') organizationId: string,
    @Body() body: { userId: string; role?: User['role'] },
  ) {
    const membership = await this.organizationService.upsertOrganizationMember(
      organizationId,
      body.userId,
      body.role ?? 'member',
    );
    return { organizationId, membership };
  }
}
