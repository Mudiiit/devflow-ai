import { Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../decorators/rate-limit.decorator.js';
import { RateLimitGuard } from '../guards/rate-limit.guard.js';
import { WebhookSignatureGuard } from '../guards/webhook-signature.guard.js';
import { RepositorySyncService } from '../services/repository-sync.service.js';
import { AUTH_WEBHOOK_EVENT_HEADER } from '../auth.constants.js';

@Controller('webhooks/github')
@UseGuards(WebhookSignatureGuard, RateLimitGuard)
export class WebhooksController {
  constructor(private readonly repositorySyncService: RepositorySyncService) {}

  @Post()
  @RateLimit({ limit: 300, windowMs: 60_000 })
  async handleWebhook(@Headers(AUTH_WEBHOOK_EVENT_HEADER) event: string, @Req() request: Request & { body: Buffer }): Promise<{ received: true }> {
    const payload = JSON.parse(request.body.toString('utf8')) as { installation?: { id: number }; action?: string };

    if (event === 'installation' || event === 'installation_repositories' || event === 'repository') {
      const installationId = payload.installation?.id;

      if (installationId) {
        await this.repositorySyncService.syncInstallation(installationId);
      }
    }

    return { received: true };
  }
}