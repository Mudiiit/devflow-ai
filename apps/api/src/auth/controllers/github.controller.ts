import { Controller, Get, Param, Post, Query, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { StructuredLoggerService } from '@devflow/logger';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { RateLimit } from '../decorators/rate-limit.decorator.js';
import { RateLimitGuard } from '../guards/rate-limit.guard.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';
import { GitHubAppStrategy } from '../strategies/github-app.strategy.js';
import { RepositorySyncService } from '../services/repository-sync.service.js';
import { OauthStateService } from '../services/oauth-state.service.js';
import type {
  GitHubInstallationStatusDto,
  GitHubInstallationSyncDto,
  GitHubInstallationSummaryDto,
  GitHubRepositoryConnectionDto,
} from '../dto/github-installation.dto.js';

@Controller('integrations/github')
export class GithubController {
  constructor(
    private readonly githubAppStrategy: GitHubAppStrategy,
    private readonly repositorySyncService: RepositorySyncService,
    private readonly oauthStateService: OauthStateService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Get('install')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async install(@Query('returnTo') returnTo: string | undefined) {
    try {
      const { state } = await this.oauthStateService.createState(returnTo);
      return {
        installationUrl: this.githubAppStrategy
          .buildInstallationUrl(state)
          .toString(),
      };
    } catch (error: unknown) {
      this.logger.event(
        'error',
        'github.installation.url.failed',
        { returnTo: returnTo ?? null },
        error instanceof Error ? error : undefined,
      );

      throw new ServiceUnavailableException(
        'GitHub installation setup is temporarily unavailable',
      );
    }
  }

  @Get('installations')
  @UseGuards(JwtAuthGuard)
  async listInstallations(@CurrentUser() user: { id: string }): Promise<{
    userId: string;
    installations: GitHubInstallationSummaryDto[];
  }> {
    const installations =
      await this.repositorySyncService.listInstallationsForUser(user.id);

    return {
      userId: user.id,
      installations,
    };
  }

  @Get('installations/:installationId/status')
  @UseGuards(JwtAuthGuard)
  async getInstallationStatus(
    @Param('installationId') installationId: string,
  ): Promise<{ installation: GitHubInstallationStatusDto }> {
    return {
      installation: await this.repositorySyncService.getInstallationStatus(
        this.parseId(installationId, 'installationId'),
      ),
    };
  }

  @Get('installations/:installationId/repositories')
  @UseGuards(JwtAuthGuard)
  async listInstallationRepositories(
    @Param('installationId') installationId: string,
  ): Promise<{ installation: GitHubInstallationStatusDto }> {
    return {
      installation: await this.repositorySyncService.getInstallationStatus(
        this.parseId(installationId, 'installationId'),
      ),
    };
  }

  @Post('installations/:installationId/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  async syncInstallation(
    @Param('installationId') installationId: string,
  ): Promise<GitHubInstallationSyncDto> {
    return this.repositorySyncService.syncInstallation(
      this.parseId(installationId, 'installationId'),
    );
  }

  @Post('installations/:installationId/repositories/:repositoryId/connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  async connectRepository(
    @Param('installationId') installationId: string,
    @Param('repositoryId') repositoryId: string,
  ): Promise<GitHubRepositoryConnectionDto> {
    return this.repositorySyncService.connectRepository(
      this.parseId(installationId, 'installationId'),
      this.parseId(repositoryId, 'repositoryId'),
    );
  }

  private parseId(value: string, label: string): number {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid ${label}`);
    }

    return parsed;
  }
}
