import { AIProviderError, isRetryableStatus } from './errors.js';
import type { AIProviderName } from './types.js';
import { SpanKind } from '@opentelemetry/api';
import { injectTraceHeaders, runWithSpan } from '@devflow/tracing';

export interface JsonHttpRequest {
  readonly provider: AIProviderName;
  readonly url: string;
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

const readResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type');
  if (contentType !== null && contentType.toLowerCase().includes('application/json')) {
    try {
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
};

export const postJson = async <TResponse>(request: JsonHttpRequest): Promise<TResponse> => {
  return runWithSpan('ai.provider.request', {
    kind: SpanKind.CLIENT,
    attributes: {
      'ai.provider': request.provider,
      'http.method': request.method,
      'url.full': request.url,
    },
  }, async () => {
    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? 30_000;

    const relayAbort = (): void => {
      controller.abort(request.signal?.reason);
    };

    if (request.signal !== undefined) {
      if (request.signal.aborted) {
        relayAbort();
      } else {
        request.signal.addEventListener('abort', relayAbort, { once: true });
      }
    }

    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: injectTraceHeaders(request.headers),
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });

      const parsedBody = await readResponseBody(response);

      if (!response.ok) {
        throw new AIProviderError('AI_HTTP_ERROR', `HTTP ${response.status} from ${request.provider} API`, {
          provider: request.provider,
          statusCode: response.status,
          retryable: isRetryableStatus(response.status),
          cause: parsedBody,
        });
      }

      return parsedBody as TResponse;
    } catch (error: unknown) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIProviderError('AI_TIMEOUT_ERROR', `Timed out while calling ${request.provider} API`, {
          provider: request.provider,
          retryable: true,
          cause: error,
        });
      }

      throw new AIProviderError('AI_NETWORK_ERROR', `Network error while calling ${request.provider} API`, {
        provider: request.provider,
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timeoutId);
      if (request.signal !== undefined) {
        request.signal.removeEventListener('abort', relayAbort);
      }
    }
  });
};
