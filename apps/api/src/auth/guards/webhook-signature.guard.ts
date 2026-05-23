import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { serverEnv } from '@devflow/config';
import { AUTH_WEBHOOK_SIGNATURE_HEADER } from '../auth.constants.js';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { body: Buffer }>();
    const signature = request.headers[AUTH_WEBHOOK_SIGNATURE_HEADER] as string | undefined;

    if (!signature || !serverEnv.GITHUB_WEBHOOK_SECRET || !Buffer.isBuffer(request.body)) {
      return false;
    }

    const expected = createHmac('sha256', serverEnv.GITHUB_WEBHOOK_SECRET).update(request.body).digest('hex');
    const received = signature.replace('sha256=', '');

    return expected.length === received.length && timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
  }
}