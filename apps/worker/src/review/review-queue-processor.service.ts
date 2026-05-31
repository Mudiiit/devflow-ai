import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { ReviewJobsRepository } from '@devflow/database';
import { MetricsService, StructuredLoggerService } from '@devflow/logger';
import { createRedisConnection, reviewJobQueueName, type ReviewQueueJobData } from '@devflow/config';
import { serverEnv } from '@devflow/config/server';
import { ReviewJobDispatcherService } from './review-worker.service.js';
import { ReviewQueueService } from './review-queue.service.js';

@Injectable()
export class ReviewQueueProcessorService implements OnModuleInit, OnApplicationShutdown {
  private worker: Worker<ReviewQueueJobData> | null = null;
  private connection: any | null = null;

  constructor(
    private readonly reviewJobsRepository: ReviewJobsRepository,
    private readonly reviewJobDispatcherService: ReviewJobDispatcherService,
    private readonly reviewQueueService: ReviewQueueService,
    private readonly metricsService: MetricsService,
    private readonly logger: StructuredLoggerService,
  ) {}

  onModuleInit(): void {
    if (!this.reviewQueueService.isEnabled()) {
      return;
    }

    const concurrency = this.resolveConcurrency();
    this.connection = createRedisConnection(serverEnv.REDIS_URL!, 'devflow-worker-review-processor');
    this.worker = new Worker<ReviewQueueJobData>(reviewJobQueueName, async (job) => {
      return this.processJob(job);
    }, {
      connection: this.connection,
      concurrency,
    });

    this.metricsService.setGauge('devflow_review_queue_worker_concurrency', concurrency, { service: 'worker' });
    this.worker.on('failed', (job, error) => {
      if (!job) {
        return;
      }

      this.logger.event('warn', 'worker.queue.job.failed', {
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        error: error instanceof Error ? error.message : 'Unknown queue failure',
      }, error instanceof Error ? error : undefined);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.worker !== null) {
      await this.worker.close();
    }

    if (this.connection !== null) {
      await this.connection.quit();
    }
  }

  private async processJob(job: Job<ReviewQueueJobData>): Promise<void> {
    const reviewJob = await this.reviewJobsRepository.findById(job.data.reviewJobId);

    if (!reviewJob) {
      throw new Error(`Review job ${job.data.reviewJobId} was not found`);
    }

    try {
      await this.reviewJobDispatcherService.processQueuedJob(reviewJob);
    } catch (error: unknown) {
      const attempts = typeof job.opts.attempts === 'number' && Number.isFinite(job.opts.attempts) ? job.opts.attempts : 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;

      if (isFinalAttempt) {
        await this.reviewQueueService.enqueueDeadLetter(reviewJob.id, {
          jobName: job.name,
          attemptsMade: job.attemptsMade + 1,
          maxAttempts: attempts,
          error: error instanceof Error ? error.message : 'Unknown queue failure',
          payload: job.data,
        });
        this.metricsService.increment('devflow_review_queue_dead_letters_total', { service: 'worker' });
      }

      throw error;
    }
  }

  private resolveConcurrency(): number {
    const parsed = Number(process.env.WORKER_REVIEW_MAX_CONCURRENCY ?? '2');
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
  }
}