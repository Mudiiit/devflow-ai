import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CacheService } from './services/cache.service.js';
import { FeatureFlagsService } from './services/feature-flags.service.js';
import { SecretsService } from './services/secrets.service.js';
import { AuditTrailService } from './services/audit-trail.service.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [CacheService, FeatureFlagsService, SecretsService, AuditTrailService],
  exports: [CacheService, FeatureFlagsService, SecretsService, AuditTrailService],
})
export class SecurityModule {}
