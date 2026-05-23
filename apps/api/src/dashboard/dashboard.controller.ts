import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard.js';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(@CurrentOrganization() organization: { id: string }, @Query('window') window: string | undefined) {
    return this.dashboardService.getOverview(organization.id, window);
  }

  @Get('repositories')
  async getRepositories(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getRepositoriesOverview(organization.id);
  }

  @Get('pull-requests')
  async getPullRequests(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getPullRequestsOverview(organization.id);
  }

  @Get('reviews')
  async getReviewHistory(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getReviewHistory(organization.id);
  }

  @Get('reviews/:reviewJobId')
  async getReviewDetail(
    @CurrentOrganization() organization: { id: string },
    @Param('reviewJobId') reviewJobId: string,
  ) {
    return this.dashboardService.getReviewDetail(organization.id, reviewJobId);
  }

  @Post('reviews/:reviewJobId/retry')
  async retryReview(
    @CurrentOrganization() organization: { id: string },
    @CurrentUser() user: { id: string },
    @Param('reviewJobId') reviewJobId: string,
  ) {
    return this.dashboardService.retryReview(organization.id, reviewJobId, user.id);
  }

  @Get('analytics')
  async getAnalytics(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getAnalytics(organization.id);
  }

  @Get('activity')
  async getActivity(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getRecentActivity(organization.id);
  }

  @Get('health')
  async getHealth(@CurrentOrganization() organization: { id: string }) {
    return this.dashboardService.getRepositoryHealth(organization.id);
  }

  @Post('settings/strictness')
  async updateStrictness(
    @CurrentOrganization() organization: { id: string },
    @Body() body: { reviewStrictness: number },
  ) {
    return this.dashboardService.updateOrgStrictness(organization.id, body.reviewStrictness);
  }
}
