import { Module, OnApplicationShutdown } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ObservabilityModule } from '@devflow/logger';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { DATABASE_CLIENT } from './database/database.constants.js';
import { AuthModule } from './auth/auth.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { BillingModule } from './billing/billing.module.js';
import { SecurityModule } from './security/security.module.js';
import { TransformInterceptor } from './common/transform.interceptor.js';

@Module({
  imports: [
    DatabaseModule,
    ObservabilityModule.register({
      serviceName: 'api',
      databaseClientToken: DATABASE_CLIENT,
    }),
    AuthModule,
    OrganizationsModule,
    SecurityModule,
    DashboardModule,
    SettingsModule,
    NotificationsModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Close rate-limit redis connection exposed by middleware on shutdown
    {
      provide: 'RATE_LIMIT_REDIS_LIFECYCLE',
      useClass: class RateLimitRedisLifecycle implements OnApplicationShutdown {
        async onApplicationShutdown(): Promise<void> {
          try {
            const redis = (global as any).__devflow_api_rate_limit_redis;
            if (redis && typeof redis.quit === 'function') {
              await redis.quit();
            }
          } catch (err) {
            // ignore shutdown errors
          }
        }
      },
    },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
