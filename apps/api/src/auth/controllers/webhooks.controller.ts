import { Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../decorators/rate-limit.decorator.js';
import { RateLimitGuard } from '../guards/rate-limit.guard.js';
import { WebhookSignatureGuard } from '../guards/webhook-signature.guard.js';
import { AUTH_WEBHOOK_EVENT_HEADER } from '../auth.constants.js';
import { GitHubWebhookService } from '../services/github-webhook.service.js';
import type { GitHubWebhookIngestionResultDto } from '../dto/github-webhook.dto.js';

@Controller('webhooks/github')
@UseGuards(WebhookSignatureGuard, RateLimitGuard)
export class WebhooksController {
  constructor(private readonly githubWebhookService: GitHubWebhookService) {}

  @Post()
  @RateLimit({ limit: 300, windowMs: 60_000 })
  async handleWebhook(@Headers(AUTH_WEBHOOK_EVENT_HEADER) event: string, @Req() request: Request & { body: Buffer }): Promise<GitHubWebhookIngestionResultDto> {
    return this.githubWebhookService.handleWebhook(event as 'installation' | 'installation_repositories' | 'repository' | 'pull_request', request.body);
  }
}