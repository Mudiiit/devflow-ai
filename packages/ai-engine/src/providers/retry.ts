import { isRetryableError } from './errors.js';
import type { AIRetryPolicy } from './types.js';

const RETRYABLE_STATUS_CODES = new Set<number>([408, 409, 425, 429, 500, 502, 503, 504]);

export const DEFAULT_RETRY_POLICY: AIRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  backoffMultiplier: 2,
  jitterRatio: 0.2,
  retryableStatusCodes: RETRYABLE_STATUS_CODES,
};

export const mergeRetryPolicy = (policy?: Partial<AIRetryPolicy>): AIRetryPolicy => {
  if (policy === undefined) {
    return DEFAULT_RETRY_POLICY;
  }

  return {
    maxAttempts: policy.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
    baseDelayMs: policy.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs,
    maxDelayMs: policy.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs,
    backoffMultiplier: policy.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier,
    jitterRatio: policy.jitterRatio ?? DEFAULT_RETRY_POLICY.jitterRatio,
    retryableStatusCodes: policy.retryableStatusCodes ?? DEFAULT_RETRY_POLICY.retryableStatusCodes,
  };
};

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

const computeDelayMs = (attempt: number, policy: AIRetryPolicy): number => {
  const exponentialDelay = Math.min(
    policy.maxDelayMs,
    Math.round(policy.baseDelayMs * policy.backoffMultiplier ** (attempt - 1)),
  );
  const jitterMax = Math.round(exponentialDelay * policy.jitterRatio);
  const jitter = jitterMax > 0 ? Math.floor(Math.random() * (jitterMax + 1)) : 0;
  return exponentialDelay + jitter;
};

export const withRetry = async <T>(
  execute: (attempt: number) => Promise<T>,
  policyInput?: Partial<AIRetryPolicy>,
): Promise<T> => {
  const policy = mergeRetryPolicy(policyInput);

  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await execute(attempt);
    } catch (error: unknown) {
      lastError = error;
      const canRetry = attempt < policy.maxAttempts && isRetryableError(error);
      if (!canRetry) {
        throw error;
      }
      await sleep(computeDelayMs(attempt, policy));
    }
  }

  throw lastError;
};
