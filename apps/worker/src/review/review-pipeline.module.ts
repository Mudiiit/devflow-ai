import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ReviewJobDispatcherService } from './review-worker.service.js';
import { ReviewPipelineService } from './review-pipeline.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ReviewPipelineService, ReviewJobDispatcherService],
  exports: [ReviewPipelineService],
})
export class ReviewPipelineModule {}
