import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { MetricsService } from '@devflow/logger';
import { ReviewQueueService } from './review-queue.service.js';

const QUEUE_METRIC_POLL_INTERVAL_MS = 15_000;

@Injectable()
export class ReviewQueueMetricsService implements OnModuleInit, OnApplicationShutdown {
  private pollTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly reviewQueueService: ReviewQueueService,
    private readonly metricsService: MetricsService,
  ) {}

  onModuleInit(): void {
    if (!this.reviewQueueService.isEnabled()) {
      return;
    }

    void this.pollQueueCounts();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollQueueCounts(): Promise<void> {
    if (this.stopped || !this.reviewQueueService.isEnabled()) {
      return;
    }

    try {
      const counts = await this.reviewQueueService.getQueueCounts();
      if (counts !== null) {
        for (const [key, value] of Object.entries(counts)) {
          this.metricsService.setGauge(`devflow_review_queue_${key}_total`, value, { service: 'worker' });
        }
      }
    } finally {
      this.pollTimer = setTimeout(() => {
        void this.pollQueueCounts();
      }, QUEUE_METRIC_POLL_INTERVAL_MS);
    }
  }
}