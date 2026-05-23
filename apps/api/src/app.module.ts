import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({
  imports: [AuthModule, OrganizationsModule, DashboardModule, SettingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
