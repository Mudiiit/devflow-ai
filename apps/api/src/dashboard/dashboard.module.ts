import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
