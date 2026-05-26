import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeysService } from '../services/api-keys.service.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        authSession?: {
          user?: { id: string; role: 'member'; status: 'active' };
        };
        apiAuth?: {
          apiKeyId: string;
          organizationId: string;
          scopes: string[];
        };
      }
    >();

    const header = request.headers['x-api-key'];
    const apiKey = Array.isArray(header) ? header[0] : header;

    if (!apiKey || apiKey.length < 20) {
      return false;
    }

    const verified = await this.apiKeysService.verifyToken(apiKey);
    if (!verified) {
      return false;
    }

    request.apiAuth = {
      apiKeyId: verified.apiKeyId,
      organizationId: verified.organizationId,
      scopes: verified.scopes,
    };

    request.authSession = {
      user: {
        id: `api-key:${verified.apiKeyId}`,
        role: 'member',
        status: 'active',
      },
    };

    return true;
  }
}
