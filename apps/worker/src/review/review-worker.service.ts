import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ReviewJobsRepository } from '@devflow/database';
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
  ) {}

  public onModuleInit(): void {
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

    const availableSlots = this.maxConcurrency - this.activeJobs.size;
    if (availableSlots <= 0) {
      await this.schedulePoll(this.pollIntervalMs);
      return;
    }

    const queuedJobs = await this.reviewJobsRepository.findQueued(availableSlots);
    if (queuedJobs.length === 0) {
      await this.schedulePoll(this.pollIntervalMs);
      return;
    }

    for (const job of queuedJobs) {
      if (this.activeJobs.size >= this.maxConcurrency) {
        break;
      }

      this.activeJobs.add(job.id);
      void this.reviewPipelineService
        .processReviewJob(job.id)
        .catch(() => undefined)
        .finally(() => {
          this.activeJobs.delete(job.id);
        });
    }

    await this.schedulePoll(0);
  }
}