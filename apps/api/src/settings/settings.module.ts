import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, OrganizationsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
