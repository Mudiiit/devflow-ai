import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard.js';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('organization')
  async getOrganizationSettings(@CurrentOrganization() organization: { id: string }) {
    return this.settingsService.getOrganizationSettings(organization.id);
  }

  @Put('organization')
  async updateOrganizationSettings(
    @CurrentOrganization() organization: { id: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateOrganizationSettings(organization.id, body);
  }

  @Get('repositories')
  async getRepositorySettings(@CurrentOrganization() organization: { id: string }) {
    return this.settingsService.getRepositorySettings(organization.id);
  }

  @Put('repositories/:repositoryId')
  async updateRepositorySettings(
    @CurrentOrganization() organization: { id: string },
    @Param('repositoryId') repositoryId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settingsService.updateRepositorySettings(organization.id, repositoryId, body);
  }
}
