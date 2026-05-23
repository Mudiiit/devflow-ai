import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationService } from './organizations.service.js';
import { OrganizationMemberGuard } from './guards/organization-member.guard.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OrganizationsController],
  providers: [OrganizationService, OrganizationMemberGuard],
  exports: [OrganizationService, OrganizationMemberGuard],
})
export class OrganizationsModule {}
