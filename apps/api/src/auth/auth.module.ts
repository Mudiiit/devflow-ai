import {
  Global,
  Module,
  type NestModule,
  type MiddlewareConsumer,
} from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { ApiKeysController } from './controllers/api-keys.controller.js';
import { GithubController } from './controllers/github.controller.js';
import { WebhooksController } from './controllers/webhooks.controller.js';
import { AuthSessionInterceptor } from './interceptors/auth-session.interceptor.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';
import { ApiScopeGuard } from './guards/api-scope.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OrganizationPermissionGuard } from './guards/organization-permission.guard.js';
import { RateLimitGuard } from './guards/rate-limit.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard.js';
import { ApiKeysService } from './services/api-keys.service.js';
import { JwtService } from './services/jwt.service.js';
import { SessionService } from './services/session.service.js';
import { OauthStateService } from './services/oauth-state.service.js';
import { GitHubOAuthService } from './services/github-oauth.service.js';
import { GitHubAppService } from './services/github-app.service.js';
import { ReviewQueueService } from './services/review-queue.service.js';
import { RepositorySyncService } from './services/repository-sync.service.js';
import { GitHubWebhookService } from './services/github-webhook.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { GitHubOAuthStrategy } from './strategies/github-oauth.strategy.js';
import { GitHubAppStrategy } from './strategies/github-app.strategy.js';

@Global()
@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [
    AuthController,
    ApiKeysController,
    GithubController,
    WebhooksController,
  ],
  providers: [
    ApiKeysService,
    JwtService,
    SessionService,
    OauthStateService,
    GitHubOAuthService,
    GitHubAppService,
    ReviewQueueService,
    RepositorySyncService,
    GitHubWebhookService,
    JwtStrategy,
    GitHubOAuthStrategy,
    GitHubAppStrategy,
    ApiKeyGuard,
    ApiScopeGuard,
    CsrfGuard,
    JwtAuthGuard,
    OrganizationPermissionGuard,
    RateLimitGuard,
    RolesGuard,
    WebhookSignatureGuard,
    AuthSessionInterceptor,
  ],
  exports: [
    ApiKeysService,
    JwtService,
    SessionService,
    GitHubOAuthService,
    GitHubAppService,
    ReviewQueueService,
    RepositorySyncService,
    GitHubWebhookService,
    ApiKeyGuard,
    ApiScopeGuard,
    OrganizationPermissionGuard,
  ],
})
export class AuthModule {}
