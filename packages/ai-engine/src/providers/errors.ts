import type { AIProviderName } from './types.js';

export type AIErrorCode =
  | 'AI_HTTP_ERROR'
  | 'AI_NETWORK_ERROR'
  | 'AI_TIMEOUT_ERROR'
  | 'AI_RESPONSE_ERROR'
  | 'AI_CONFIGURATION_ERROR';

export interface AIErrorOptions {
  readonly provider?: AIProviderName;
  readonly statusCode?: number;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

export class AIProviderError extends Error {
  public readonly code: AIErrorCode;
  public readonly provider: AIProviderName | undefined;
  public readonly statusCode: number | undefined;
  public readonly retryable: boolean;

  public constructor(code: AIErrorCode, message: string, options: AIErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AIProviderError';
    this.code = code;
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
  }
}

export const isRetryableStatus = (statusCode: number): boolean => {
  return statusCode === 408 || statusCode === 409 || statusCode === 425 || statusCode === 429 || statusCode >= 500;
};

export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof AIProviderError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('timeout') || message.includes('network');
  }

  return false;
};
