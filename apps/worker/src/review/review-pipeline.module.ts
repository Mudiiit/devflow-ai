import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ReviewPipelineService } from './review-pipeline.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ReviewPipelineService],
  exports: [ReviewPipelineService],
})
export class ReviewPipelineModule {}
