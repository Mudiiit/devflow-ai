import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { OrganizationPermissionGuard } from '../auth/guards/organization-permission.guard.js';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard.js';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { parsePagination } from '../common/query/pagination.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, OrganizationPermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Permissions('analytics.read')
  async getOverview(
    @CurrentOrganization() organization: { id: string },
    @Query('window') window: string | undefined,
  ) {
    return this.dashboardService.getOverview(organization.id, window);
  }

  @Get('repositories')
  @Permissions('analytics.read')
  async getRepositories(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getRepositoriesOverview(organization.id);
  }

  @Get('pull-requests')
  @Permissions('analytics.read')
  async getPullRequests(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getPullRequestsOverview(organization.id);
  }

  @Get('reviews')
  @Permissions('analytics.read')
  async getReviewHistory(
    @CurrentOrganization() organization: { id: string },
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('status') status: string | undefined,
  ) {
    const pagination = parsePagination(
      { page, pageSize },
      {
        page: 1,
        pageSize: 25,
        maxPageSize: 100,
      },
    );

    const result = await this.dashboardService.getReviewHistory(
      organization.id,
      {
        page: pagination.page,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        status,
      },
    );

    const { formatPaginatedResponse } =
      await import('../common/query/response.js');
    return formatPaginatedResponse(result.reviews, result.pagination);
  }

  @Get('jobs')
  @Permissions('analytics.read')
  async getJobMonitoring(
    @CurrentOrganization() organization: { id: string },
    @Query('limit') limit: string | undefined,
  ) {
    const parsedLimit = limit === undefined ? 25 : Number(limit);
    return this.dashboardService.getJobMonitoring(
      organization.id,
      Number.isFinite(parsedLimit) ? parsedLimit : 25,
    );
  }

  @Get('reviews/:reviewJobId')
  @Permissions('review.read')
  async getReviewDetail(
    @CurrentOrganization() organization: { id: string },
    @Param('reviewJobId') reviewJobId: string,
  ) {
    return this.dashboardService.getReviewDetail(organization.id, reviewJobId);
  }

  @Post('reviews/:reviewJobId/retry')
  @Permissions('review.write')
  async retryReview(
    @CurrentOrganization() organization: { id: string },
    @CurrentUser() user: { id: string },
    @Param('reviewJobId') reviewJobId: string,
  ) {
    return this.dashboardService.retryReview(
      organization.id,
      reviewJobId,
      user.id,
    );
  }

  @Get('analytics')
  @Permissions('analytics.read')
  async getAnalytics(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getAnalytics(organization.id);
  }

  @Get('activity')
  @Permissions('analytics.read')
  async getActivity(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getRecentActivity(organization.id);
  }

  @Get('health')
  @Permissions('analytics.read')
  async getHealth(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getRepositoryHealth(organization.id);
  }

  @Post('settings/strictness')
  @Permissions('settings.manage')
  async updateStrictness(
    @CurrentOrganization() organization: { id: string },
    @Body() body: { reviewStrictness: number },
  ) {
    return this.dashboardService.updateOrgStrictness(
      organization.id,
      body.reviewStrictness,
    );
  }

  @Get('admin/analytics')
  @Permissions('admin.analytics.read')
  async getAdminAnalytics(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getAdminAnalytics(organization.id);
  }
}
