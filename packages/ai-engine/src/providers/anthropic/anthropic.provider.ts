import { AIProviderError } from '../errors.js';
import { postJson } from '../http-client.js';
import { buildIdempotencyKey, mergeHeaders } from '../request-utils.js';
import { withRetry } from '../retry.js';
import type { AIProvider, AIProviderRequest, AIProviderResponse, AIRequestContext } from '../types.js';

export interface AnthropicProviderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly anthropicVersion?: string;
  readonly defaultTimeoutMs?: number;
  readonly defaultMaxOutputTokens?: number;
}

interface AnthropicMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

interface AnthropicRequestPayload {
  readonly model: string;
  readonly system?: string;
  readonly messages: ReadonlyArray<AnthropicMessage>;
  readonly temperature?: number;
  readonly max_tokens: number;
  readonly top_p?: number;
  readonly stop_sequences?: ReadonlyArray<string>;
}

interface AnthropicContentBlock {
  readonly type: string;
  readonly text?: string;
}

interface AnthropicUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
}

interface AnthropicResponse {
  readonly id: string;
  readonly model: string;
  readonly stop_reason?: string;
  readonly content?: ReadonlyArray<AnthropicContentBlock>;
  readonly usage?: AnthropicUsage;
}

const toAnthropicMessages = (messages: AIProviderRequest['messages']): AnthropicMessage[] => {
  const result: AnthropicMessage[] = [];
  for (const message of messages) {
    if (message.role === 'system') {
      continue;
    }
    result.push({ role: message.role, content: message.content });
  }
  return result;
};

const toSystemPrompt = (messages: AIProviderRequest['messages']): string | undefined => {
  const prompts = messages.filter((message) => message.role === 'system').map((message) => message.content.trim());
  const filtered = prompts.filter((value) => value.length > 0);
  if (filtered.length === 0) {
    return undefined;
  }
  return filtered.join('\n\n');
};

const extractContent = (response: AnthropicResponse): string => {
  const blocks = response.content ?? [];
  return blocks
    .filter((block) => block.type === 'text' && typeof block.text === 'string' && block.text.length > 0)
    .map((block) => block.text as string)
    .join('\n')
    .trim();
};

export class AnthropicProvider implements AIProvider {
  public readonly provider = 'anthropic' as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly anthropicVersion: string;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxOutputTokens: number;

  public constructor(config: AnthropicProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1';
    this.anthropicVersion = config.anthropicVersion ?? '2023-06-01';
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30_000;
    this.defaultMaxOutputTokens = config.defaultMaxOutputTokens ?? 1_024;

    if (this.apiKey.length === 0) {
      throw new AIProviderError('AI_CONFIGURATION_ERROR', 'Anthropic API key is required', {
        provider: this.provider,
      });
    }
  }

  public async complete(request: AIProviderRequest, context: AIRequestContext = {}): Promise<AIProviderResponse> {
    return await withRetry(async () => {
      const anthropicMessages = toAnthropicMessages(request.messages);
      if (anthropicMessages.length === 0) {
        throw new AIProviderError('AI_RESPONSE_ERROR', 'Anthropic request requires at least one user or assistant message', {
          provider: this.provider,
          retryable: false,
        });
      }

      const payload: AnthropicRequestPayload = {
        model: request.model,
        system: toSystemPrompt(request.messages),
        messages: anthropicMessages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens ?? this.defaultMaxOutputTokens,
        top_p: request.topP,
        stop_sequences: request.stopSequences,
      };

      const headers = mergeHeaders(
        {
          'x-api-key': this.apiKey,
          'anthropic-version': this.anthropicVersion,
          'content-type': 'application/json',
          'idempotency-key': context.idempotencyKey ?? buildIdempotencyKey(this.provider, request),
        },
        context.requestId === undefined ? undefined : { 'x-request-id': context.requestId },
        context.extraHeaders,
      );

      const response = await postJson<AnthropicResponse>({
        provider: this.provider,
        method: 'POST',
        url: `${this.baseUrl}/messages`,
        headers,
        body: payload,
        timeoutMs: context.timeoutMs ?? this.defaultTimeoutMs,
        signal: context.signal,
      });

      const usage = response.usage;
      const promptTokens = usage?.input_tokens ?? 0;
      const completionTokens = usage?.output_tokens ?? 0;

      return {
        provider: this.provider,
        model: response.model,
        id: response.id,
        content: extractContent(response),
        finishReason: response.stop_reason ?? null,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        raw: response,
      };
    }, context.retryPolicy);
  }
}
