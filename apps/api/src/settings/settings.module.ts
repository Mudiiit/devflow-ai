import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
