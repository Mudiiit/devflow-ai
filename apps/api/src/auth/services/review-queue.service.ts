import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';
import {
  createRedisConnection,
  isRedisConnectionEnabled,
  reviewJobQueueDefaults,
  reviewJobQueueJobName,
  reviewJobQueueName,
  type ReviewQueueJobData,
} from '@devflow/config';

import { serverEnv } from '@devflow/config/server';

@Injectable()
export class ReviewQueueService implements OnApplicationShutdown {
  private queue: Queue<ReviewQueueJobData> | null = null;
  private connection: any | null = null;
  private enabled = false;

  constructor() {
    if (!isRedisConnectionEnabled(serverEnv.REDIS_URL)) {
      console.warn('Redis unavailable, continuing without queues');
      console.warn('Workers disabled');
      return;
    }

    try {
      this.connection = createRedisConnection(
        serverEnv.REDIS_URL,
        'devflow-api-review-queue',
      );
      if (this.connection && typeof this.connection.on === 'function') {
        this.connection.on('error', (error: unknown) => {
          console.warn(
            '[api] review queue redis error: %s',
            error instanceof Error ? error.message : String(error),
          );
        });
      }

      this.queue = new Queue<ReviewQueueJobData>(reviewJobQueueName, {
        connection: this.connection,
        defaultJobOptions: {
          attempts:
            serverEnv.REVIEW_QUEUE_ATTEMPTS ?? reviewJobQueueDefaults.attempts,
          backoff: {
            type: 'exponential',
            delay:
              serverEnv.REVIEW_QUEUE_BACKOFF_MS ??
              reviewJobQueueDefaults.backoffMs,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      });

      this.enabled = true;
    } catch (error) {
      this.enabled = false;
      this.queue = null;
      this.connection = null;
      console.warn('Redis unavailable, continuing without queues');
      console.warn('Workers disabled');
      console.warn(
        '[api] review queue initialization failed: %s',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async enqueueReviewJob(
    reviewJobId: string,
    payload: Omit<ReviewQueueJobData, 'reviewJobId'> = {},
  ): Promise<boolean> {
    if (this.queue === null) {
      return false;
    }

    const jobOptions: JobsOptions = {
      jobId: reviewJobId,
      attempts:
        serverEnv.REVIEW_QUEUE_ATTEMPTS ?? reviewJobQueueDefaults.attempts,
      backoff: {
        type: 'exponential',
        delay:
          serverEnv.REVIEW_QUEUE_BACKOFF_MS ?? reviewJobQueueDefaults.backoffMs,
      },
      removeOnComplete: true,
      removeOnFail: false,
    };

    try {
      await this.queue.add(
        reviewJobQueueJobName,
        { reviewJobId, ...payload },
        jobOptions,
      );
      return true;
    } catch (error) {
      console.warn(
        '[api] review queue enqueue failed, continuing without queue delivery: %s',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      if (this.queue !== null) {
        await this.queue.close();
      }
    } catch (error) {
      console.warn(
        '[api] review queue shutdown warning: %s',
        error instanceof Error ? error.message : String(error),
      );
    }

    try {
      if (this.connection !== null) {
        await this.connection.quit();
      }
    } catch (error) {
      console.warn(
        '[api] review queue redis shutdown warning: %s',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
