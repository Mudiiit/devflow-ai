import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { serverEnv } from '@devflow/config';
import { AUTH_WEBHOOK_SIGNATURE_HEADER } from '../auth.constants.js';
import { verifyHmacSha256Signature } from '../utils/webhook-verification.js';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { body: Buffer }>();
    const headerValue = request.headers[AUTH_WEBHOOK_SIGNATURE_HEADER];
    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (
      !signature ||
      !serverEnv.GITHUB_WEBHOOK_SECRET ||
      !Buffer.isBuffer(request.body)
    ) {
      return false;
    }

    return verifyHmacSha256Signature(
      request.body,
      signature,
      serverEnv.GITHUB_WEBHOOK_SECRET,
    );
  }
}
