import Redis from 'ioredis';

export type ReviewQueueJobData = Readonly<{
  readonly reviewJobId: string;
  readonly requestId?: string;
  readonly traceContext?: Record<string, string>;
}>;

export const reviewJobQueueName = 'devflow-review-jobs';
export const reviewJobQueueJobName = 'review-job';
export const reviewJobDeadLetterQueueName = 'devflow-review-jobs-dlq';

export const reviewJobQueueDefaults = {
  attempts: 5,
  backoffMs: 10_000,
} as const;

export const isRedisConnectionEnabled = (redisUrl: string | undefined | null): redisUrl is string => {
  return typeof redisUrl === 'string' && redisUrl.trim().length > 0;
};

export const createRedisConnection = (redisUrl: string, connectionName: string): any => {
  const RedisClient = Redis as unknown as new (url: string, options: Record<string, unknown>) => any;

  return new RedisClient(redisUrl, {
    connectionName,
    lazyConnect: false,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
};