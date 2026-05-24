import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationService } from './organizations.service.js';
import { OrganizationMemberGuard } from './guards/organization-member.guard.js';
import { RepositoryAccessGuard } from './guards/repository-access.guard.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OrganizationsController],
  providers: [OrganizationService, OrganizationMemberGuard, RepositoryAccessGuard],
  exports: [OrganizationService, OrganizationMemberGuard, RepositoryAccessGuard],
})
export class OrganizationsModule {}
