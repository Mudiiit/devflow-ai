import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';
import { createRedisConnection, isRedisConnectionEnabled, reviewJobQueueDefaults, reviewJobQueueJobName, reviewJobQueueName, serverEnv, type ReviewQueueJobData } from '@devflow/config';

@Injectable()
export class ReviewQueueService implements OnApplicationShutdown {
  private readonly queue: Queue<ReviewQueueJobData> | null;
  private readonly connection: any | null;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = isRedisConnectionEnabled(serverEnv.REDIS_URL);
    this.connection = this.enabled ? createRedisConnection(serverEnv.REDIS_URL!, 'devflow-api-review-queue') : null;
    this.queue = this.enabled
      ? new Queue<ReviewQueueJobData>(reviewJobQueueName, {
          connection: this.connection,
          defaultJobOptions: {
            attempts: serverEnv.REVIEW_QUEUE_ATTEMPTS ?? reviewJobQueueDefaults.attempts,
            backoff: {
              type: 'exponential',
              delay: serverEnv.REVIEW_QUEUE_BACKOFF_MS ?? reviewJobQueueDefaults.backoffMs,
            },
            removeOnComplete: true,
            removeOnFail: false,
          },
        })
      : null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async enqueueReviewJob(reviewJobId: string, payload: Omit<ReviewQueueJobData, 'reviewJobId'> = {}): Promise<boolean> {
    if (this.queue === null) {
      return false;
    }

    const jobOptions: JobsOptions = {
      jobId: reviewJobId,
      attempts: serverEnv.REVIEW_QUEUE_ATTEMPTS ?? reviewJobQueueDefaults.attempts,
      backoff: {
        type: 'exponential',
        delay: serverEnv.REVIEW_QUEUE_BACKOFF_MS ?? reviewJobQueueDefaults.backoffMs,
      },
      removeOnComplete: true,
      removeOnFail: false,
    };

    await this.queue.add(reviewJobQueueJobName, { reviewJobId, ...payload }, jobOptions);
    return true;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.queue === null) {
      return;
    }

    await this.queue.close();
    if (this.connection !== null) {
      await this.connection.quit();
    }
  }
}