import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { OrganizationPermissionGuard } from '../auth/guards/organization-permission.guard.js';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard.js';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator.js';
import { RepositoryAccessGuard } from '../organizations/guards/repository-access.guard.js';
import { SettingsService } from './settings.service.js';
import { SecretsService } from '../security/services/secrets.service.js';
import { FeatureFlagsService } from '../security/services/feature-flags.service.js';
import { AuditTrailService } from '../security/services/audit-trail.service.js';

@Controller('settings')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, OrganizationPermissionGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly secretsService: SecretsService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  @Get('organization')
  async getOrganizationSettings(
    @CurrentOrganization() organization: { id: string },
  ) {
    return this.settingsService.getOrganizationSettings(organization.id);
  }

  @Put('organization')
  @Permissions('settings.manage')
  async updateOrganizationSettings(
    @CurrentOrganization() organization: { id: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateOrganizationSettings(
      organization.id,
      body,
    );
  }

  @Get('repositories')
  async getRepositorySettings(
    @CurrentOrganization() organization: { id: string },
  ) {
    return this.settingsService.getRepositorySettings(organization.id);
  }

  @Put('repositories/:repositoryId')
  @UseGuards(RepositoryAccessGuard)
  @Permissions('repository.manage', 'settings.manage')
  async updateRepositorySettings(
    @CurrentOrganization() organization: { id: string },
    @Param('repositoryId') repositoryId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateRepositorySettings(
      organization.id,
      repositoryId,
      body,
    );
  }

  @Post('secrets')
  @Permissions('secrets.manage')
  async upsertSecret(
    @CurrentOrganization() organization: { id: string },
    @Body() body: { key: string; value: string; repositoryId?: string | null },
  ) {
    const secret = await this.secretsService.setSecret({
      organizationId: organization.id,
      repositoryId: body.repositoryId ?? null,
      key: body.key,
      value: body.value,
    });

    await this.auditTrailService.record({
      organizationId: organization.id,
      action: 'secret',
      entityType: 'encrypted_secret',
      entityId: secret.id,
      metadata: {
        key: body.key,
        repositoryId: body.repositoryId ?? null,
      },
    });

    return {
      id: secret.id,
      key: secret.key,
      repositoryId: secret.repositoryId,
      rotatedAt: secret.rotatedAt,
      updatedAt: secret.updatedAt,
    };
  }

  @Get('feature-flags/:key')
  async getFeatureFlag(
    @CurrentOrganization() organization: { id: string },
    @Param('key') key: string,
  ) {
    const enabled = await this.featureFlagsService.isEnabled(key, {
      organizationId: organization.id,
    });

    return { key, enabled };
  }
}
