import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { serverEnv } from '@devflow/config';
import { AUTH_WEBHOOK_SIGNATURE_HEADER } from '../auth.constants.js';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { body: Buffer }>();
    const headerValue = request.headers[AUTH_WEBHOOK_SIGNATURE_HEADER];
    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!signature || !serverEnv.GITHUB_WEBHOOK_SECRET || !Buffer.isBuffer(request.body)) {
      return false;
    }

    const received = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature;
    const expected = createHmac('sha256', serverEnv.GITHUB_WEBHOOK_SECRET).update(request.body).digest('hex');

    if (!/^[0-9a-f]+$/i.test(received) || received.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  }
}