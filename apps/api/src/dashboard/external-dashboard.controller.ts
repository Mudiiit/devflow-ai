import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiScopes } from '../auth/decorators/api-scopes.decorator.js';
import { ApiKeyGuard } from '../auth/guards/api-key.guard.js';
import { ApiScopeGuard } from '../auth/guards/api-scope.guard.js';
import { DashboardService } from './dashboard.service.js';

@Controller('external/dashboard')
@UseGuards(ApiKeyGuard, ApiScopeGuard)
export class ExternalDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiScopes('analytics:read')
  async getOverview(
    @Req() request: Request & { apiAuth?: { organizationId?: string } },
    @Query('window') window: string | undefined,
  ) {
    const organizationId = request.apiAuth?.organizationId;
    if (!organizationId) {
      return { error: 'Missing organization context' };
    }

    return this.dashboardService.getOverview(organizationId, window);
  }
}
