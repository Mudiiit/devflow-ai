import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { RateLimit } from '../decorators/rate-limit.decorator.js';
import { RateLimitGuard } from '../guards/rate-limit.guard.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';
import { GitHubAppStrategy } from '../strategies/github-app.strategy.js';
import { GitHubAppService } from '../services/github-app.service.js';
import { RepositorySyncService } from '../services/repository-sync.service.js';
import { OauthStateService } from '../services/oauth-state.service.js';

@Controller('integrations/github')
export class GithubController {
  constructor(
    private readonly githubAppStrategy: GitHubAppStrategy,
    private readonly githubAppService: GitHubAppService,
    private readonly repositorySyncService: RepositorySyncService,
    private readonly oauthStateService: OauthStateService,
  ) {}

  @Get('install')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async install(@Query('returnTo') returnTo: string | undefined) {
    const { state } = await this.oauthStateService.createState(returnTo);
    return {
      installationUrl: this.githubAppStrategy.buildInstallationUrl(state).toString(),
    };
  }

  @Get('installations')
  @UseGuards(JwtAuthGuard)
  async listInstallations(@CurrentUser() user: { id: string }) {
    return {
      userId: user.id,
      installations: [],
    };
  }

  @Post('installations/:installationId/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  async syncInstallation(@Req() request: Request) {
    const installationId = Number(request.params.installationId);
    return this.repositorySyncService.syncInstallation(installationId);
  }
}