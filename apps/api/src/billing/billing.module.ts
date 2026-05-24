import { APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { DatabaseBillingProvider } from './billing.provider.js';
import { BILLING_PROVIDER } from './billing.tokens.js';
import { BillingUsageInterceptor } from './billing.interceptor.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    DatabaseBillingProvider,
    {
      provide: BILLING_PROVIDER,
      useExisting: DatabaseBillingProvider,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BillingUsageInterceptor,
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}