import { Module } from '@nestjs/common';
import { ObservabilityModule } from '@devflow/logger';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module.js';
import { DATABASE_CLIENT } from './database/database.constants.js';
import { AuthModule } from './auth/auth.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    DatabaseModule,
    ObservabilityModule.register({
      serviceName: 'api',
      databaseClientToken: DATABASE_CLIENT,
    }),
    AuthModule,
    OrganizationsModule,
    DashboardModule,
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
