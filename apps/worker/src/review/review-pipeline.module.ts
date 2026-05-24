import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ReviewJobDispatcherService } from './review-worker.service.js';
import { ReviewPipelineService } from './review-pipeline.service.js';
import { ReviewQueueProcessorService } from './review-queue-processor.service.js';
import { ReviewQueueService } from './review-queue.service.js';
import { ReviewQueueMetricsService } from './review-queue-metrics.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ReviewPipelineService, ReviewQueueService, ReviewJobDispatcherService, ReviewQueueProcessorService, ReviewQueueMetricsService],
  exports: [ReviewPipelineService],
})
export class ReviewPipelineModule {}
