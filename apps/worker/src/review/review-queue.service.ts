import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createRedisConnection, isRedisConnectionEnabled, reviewJobDeadLetterQueueName, reviewJobQueueDefaults, reviewJobQueueJobName, reviewJobQueueName, serverEnv, type ReviewQueueJobData } from '@devflow/config';

@Injectable()
export class ReviewQueueService implements OnApplicationShutdown {
  private readonly queue: Queue<ReviewQueueJobData> | null;
  private readonly deadLetterQueue: Queue<Record<string, unknown>> | null;
  private readonly connection: any | null;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = isRedisConnectionEnabled(serverEnv.REDIS_URL);

    if (!this.enabled) {
      this.queue = null;
      this.deadLetterQueue = null;
      this.connection = null;
      return;
    }

    this.connection = createRedisConnection(serverEnv.REDIS_URL!, 'devflow-worker-review-queue');

    this.queue = new Queue<ReviewQueueJobData>(reviewJobQueueName, {
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
    });

    this.deadLetterQueue = new Queue<Record<string, unknown>>(reviewJobDeadLetterQueueName, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async enqueueReviewJob(reviewJobId: string, payload: Omit<ReviewQueueJobData, 'reviewJobId'> = {}): Promise<boolean> {
    if (this.queue === null) {
      return false;
    }

    await this.queue.add(reviewJobQueueJobName, { reviewJobId, ...payload }, {
      jobId: reviewJobId,
      attempts: serverEnv.REVIEW_QUEUE_ATTEMPTS ?? reviewJobQueueDefaults.attempts,
      backoff: {
        type: 'exponential',
        delay: serverEnv.REVIEW_QUEUE_BACKOFF_MS ?? reviewJobQueueDefaults.backoffMs,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return true;
  }

  async enqueueDeadLetter(reviewJobId: string, payload: Record<string, unknown>): Promise<void> {
    if (this.deadLetterQueue === null) {
      return;
    }

    await this.deadLetterQueue.add('review-job-failed', {
      reviewJobId,
      ...payload,
    }, {
      jobId: `${reviewJobId}:dead-letter`,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async getQueueCounts(): Promise<Record<string, number> | null> {
    if (this.queue === null) {
      return null;
    }

    return this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed', 'paused');
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.queue?.close(),
      this.deadLetterQueue?.close(),
    ].filter((entry): entry is Promise<void> => entry !== undefined));

    if (this.connection !== null) {
      await this.connection.quit();
    }
  }
}