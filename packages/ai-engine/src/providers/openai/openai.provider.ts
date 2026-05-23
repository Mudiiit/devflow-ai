import { AIProviderError } from '../errors.js';
import { postJson } from '../http-client.js';
import { buildIdempotencyKey, mergeHeaders } from '../request-utils.js';
import { withRetry } from '../retry.js';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  AIRequestContext,
  AIResponseFormat,
} from '../types.js';

export interface OpenAIProviderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly organization?: string;
  readonly project?: string;
  readonly defaultTimeoutMs?: number;
}

interface OpenAIMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

interface OpenAIResponseFormat {
  readonly type: 'text' | 'json_object';
}

interface OpenAIRequestPayload {
  readonly model: string;
  readonly messages: ReadonlyArray<OpenAIMessage>;
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly top_p?: number;
  readonly stop?: ReadonlyArray<string>;
  readonly response_format?: OpenAIResponseFormat;
}

interface OpenAIUsage {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly total_tokens?: number;
}

interface OpenAIChoice {
  readonly finish_reason?: string;
  readonly message?: {
    readonly content?: string | ReadonlyArray<{ readonly type?: string; readonly text?: string }>;
  };
}

interface OpenAICompletionResponse {
  readonly id: string;
  readonly model: string;
  readonly choices?: ReadonlyArray<OpenAIChoice>;
  readonly usage?: OpenAIUsage;
}

const toOpenAIResponseFormat = (format?: AIResponseFormat): OpenAIResponseFormat | undefined => {
  if (format === undefined) {
    return undefined;
  }

  if (format.type === 'json_object') {
    return { type: 'json_object' };
  }

  return undefined;
};

const extractContent = (choice: OpenAIChoice | undefined): string => {
  const content = choice?.message?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => typeof part.text === 'string' && part.text.length > 0)
      .map((part) => part.text as string)
      .join('\n')
      .trim();
  }

  return '';
};

const buildPayload = (request: AIProviderRequest): OpenAIRequestPayload => {
  const responseFormat = toOpenAIResponseFormat(request.responseFormat);

  return {
    model: request.model,
    messages: request.messages,
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(request.maxOutputTokens === undefined ? {} : { max_tokens: request.maxOutputTokens }),
    ...(request.topP === undefined ? {} : { top_p: request.topP }),
    ...(request.stopSequences === undefined ? {} : { stop: request.stopSequences }),
    ...(responseFormat === undefined ? {} : { response_format: responseFormat }),
  };
};

export class OpenAIProvider implements AIProvider {
  public readonly provider = 'openai' as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly organization: string | undefined;
  private readonly project: string | undefined;
  private readonly defaultTimeoutMs: number;

  public constructor(config: OpenAIProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.organization = config.organization;
    this.project = config.project;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30_000;

    if (this.apiKey.length === 0) {
      throw new AIProviderError('AI_CONFIGURATION_ERROR', 'OpenAI API key is required', {
        provider: this.provider,
      });
    }
  }

  public async complete(request: AIProviderRequest, context: AIRequestContext = {}): Promise<AIProviderResponse> {
    return await withRetry(async () => {
      const idempotencyKey = context.idempotencyKey ?? buildIdempotencyKey(this.provider, request);
      const headers = mergeHeaders(
        {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        this.organization === undefined ? undefined : { 'OpenAI-Organization': this.organization },
        this.project === undefined ? undefined : { 'OpenAI-Project': this.project },
        context.requestId === undefined ? undefined : { 'X-Request-Id': context.requestId },
        context.extraHeaders,
      );

      const response = await postJson<OpenAICompletionResponse>({
        provider: this.provider,
        method: 'POST',
        url: `${this.baseUrl}/chat/completions`,
        headers,
        body: buildPayload(request),
        timeoutMs: context.timeoutMs ?? this.defaultTimeoutMs,
        ...(context.signal === undefined ? {} : { signal: context.signal }),
      });

      const firstChoice = response.choices?.[0];
      const usage = response.usage;

      return {
        provider: this.provider,
        model: response.model,
        id: response.id,
        content: extractContent(firstChoice),
        finishReason: firstChoice?.finish_reason ?? null,
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        raw: response,
      };
    }, context.retryPolicy);
  }
}
