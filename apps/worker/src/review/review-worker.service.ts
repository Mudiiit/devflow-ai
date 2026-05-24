import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ReviewJobsRepository } from '@devflow/database';
import {
  AuditLogService,
  MetricsService,
  RequestContextService,
  StructuredLoggerService,
} from '@devflow/logger';
import { ReviewPipelineService } from './review-pipeline.service.js';

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_CONCURRENCY = 2;

const toPositiveInteger = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

@Injectable()
export class ReviewJobDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly pollIntervalMs = toPositiveInteger(process.env.WORKER_REVIEW_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS);
  private readonly maxConcurrency = toPositiveInteger(process.env.WORKER_REVIEW_MAX_CONCURRENCY, DEFAULT_MAX_CONCURRENCY);
  private readonly activeJobs = new Set<string>();
  private pollTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  public constructor(
    private readonly reviewJobsRepository: ReviewJobsRepository,
    private readonly reviewPipelineService: ReviewPipelineService,
    private readonly auditLogService: AuditLogService,
    private readonly metricsService: MetricsService,
    private readonly requestContextService: RequestContextService,
    private readonly logger: StructuredLoggerService,
  ) {}

  public onModuleInit(): void {
    this.metricsService.setGauge('devflow_worker_max_concurrency', this.maxConcurrency, { service: 'worker' });
    void this.schedulePoll(0);
  }

  public onModuleDestroy(): void {
    this.stopped = true;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async schedulePoll(delayMs: number): Promise<void> {
    if (this.stopped) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      void this.poll().catch(() => undefined);
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (this.stopped) {
      return;
    }

    const pollStartedAt = Date.now();
    const pollTraceId = randomUUID();
    await this.requestContextService.run(
      {
        requestId: pollTraceId,
        traceId: pollTraceId,
        serviceName: 'worker',
        source: 'worker',
        operation: 'poll',
        startedAt: pollStartedAt,
      },
      async () => {
        try {
          const availableSlots = this.maxConcurrency - this.activeJobs.size;
          this.metricsService.setGauge('devflow_worker_active_jobs', this.activeJobs.size, { service: 'worker' });

          if (availableSlots <= 0) {
            this.logger.event('debug', 'worker.poll.skipped', {
              reason: 'concurrency_exhausted',
              activeJobs: this.activeJobs.size,
              maxConcurrency: this.maxConcurrency,
            });
            await this.schedulePoll(this.pollIntervalMs);
            return;
          }

          const queuedJobs = await this.reviewJobsRepository.findQueued(availableSlots);
          this.metricsService.observe('devflow_worker_poll_duration_ms', Date.now() - pollStartedAt, { service: 'worker' });

          if (queuedJobs.length === 0) {
            this.logger.event('debug', 'worker.poll.idle', {
              activeJobs: this.activeJobs.size,
              maxConcurrency: this.maxConcurrency,
            });
            await this.schedulePoll(this.pollIntervalMs);
            return;
          }

          this.logger.event('info', 'worker.poll.dispatched', {
            queuedJobs: queuedJobs.length,
            activeJobs: this.activeJobs.size,
            maxConcurrency: this.maxConcurrency,
          });

          for (const job of queuedJobs) {
            if (this.activeJobs.size >= this.maxConcurrency) {
              break;
            }

            this.activeJobs.add(job.id);
            this.metricsService.setGauge('devflow_worker_active_jobs', this.activeJobs.size, { service: 'worker' });
            void this.processQueuedJob(job.id)
              .catch((error: unknown) => {
                this.logger.event('error', 'worker.job.unhandled_error', {
                  jobId: job.id,
                  error: error instanceof Error ? error.message : 'Unknown worker error',
                }, error instanceof Error ? error : undefined);
              })
              .finally(() => {
                this.activeJobs.delete(job.id);
                this.metricsService.setGauge('devflow_worker_active_jobs', this.activeJobs.size, { service: 'worker' });
              });
          }

          await this.schedulePoll(0);
        } catch (error: unknown) {
          this.metricsService.increment('devflow_worker_poll_errors_total', { service: 'worker' });
          this.logger.event('error', 'worker.poll.failed', {
            error: error instanceof Error ? error.message : 'Unknown poll failure',
          }, error instanceof Error ? error : undefined);
          await this.schedulePoll(this.pollIntervalMs);
        }
      },
    );
  }

  private async processQueuedJob(reviewJobId: string): Promise<void> {
    const startedAt = Date.now();
    const traceId = randomUUID();

    return this.requestContextService.run(
      {
        requestId: traceId,
        traceId,
        serviceName: 'worker',
        source: 'worker',
        operation: 'review_job',
        jobId: reviewJobId,
        startedAt,
      },
      async () => {
        this.logger.event('info', 'worker.job.started', { jobId: reviewJobId });
        await this.auditLogService.recordHttpRequest({
          action: 'review',
          entityType: 'review_job',
          entityId: reviewJobId,
          reviewJobId,
          metadata: {
            event: 'started',
          },
        });

        try {
          await this.reviewPipelineService.processReviewJob(reviewJobId);
          const durationMs = Date.now() - startedAt;
          this.metricsService.increment('devflow_worker_jobs_total', { service: 'worker', status: 'completed' });
          this.metricsService.observe('devflow_worker_job_duration_ms', durationMs, { service: 'worker', status: 'completed' });
          this.logger.event('info', 'worker.job.completed', { jobId: reviewJobId, durationMs });

          await this.auditLogService.recordHttpRequest({
            action: 'review',
            entityType: 'review_job',
            entityId: reviewJobId,
            reviewJobId,
            metadata: {
              event: 'completed',
              durationMs,
            },
          });
        } catch (error: unknown) {
          const durationMs = Date.now() - startedAt;
          this.metricsService.increment('devflow_worker_jobs_total', { service: 'worker', status: 'failed' });
          this.metricsService.observe('devflow_worker_job_duration_ms', durationMs, { service: 'worker', status: 'failed' });
          this.logger.event('error', 'worker.job.failed', {
            jobId: reviewJobId,
            durationMs,
            error: error instanceof Error ? error.message : 'Unknown job failure',
          }, error instanceof Error ? error : undefined);

          await this.auditLogService.recordHttpRequest({
            action: 'analysis',
            entityType: 'review_job',
            entityId: reviewJobId,
            reviewJobId,
            metadata: {
              event: 'failed',
              durationMs,
              error: error instanceof Error ? error.message : 'Unknown job failure',
            },
          });

          throw error;
        }
      },
    );
  }
}