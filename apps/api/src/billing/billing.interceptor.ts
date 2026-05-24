import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { UsageRecordsRepository } from '@devflow/database';

@Injectable()
export class BillingUsageInterceptor implements NestInterceptor {
  constructor(private readonly usageRecordsRepository: UsageRecordsRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { orgContext?: { organization?: { id: string } } }>();

    return next.handle().pipe(
      tap({
        next: () => {
          const organizationId = request.orgContext?.organization?.id;
          if (!organizationId) {
            return;
          }

          void this.usageRecordsRepository.recordUsage({
            organizationId,
            billingCustomerId: null,
            subscriptionId: null,
            pricingPlanId: null,
            resource: 'api_calls',
            quantity: 1,
            unit: 'count',
            source: 'api',
            relatedEntityType: 'http_request',
            relatedEntityId: `${request.method}:${request.originalUrl}`,
            periodStart: null,
            periodEnd: null,
            metadata: {
              method: request.method,
              path: request.originalUrl,
            },
          });
        },
      }),
    );
  }
}