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

export interface GeminiProviderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly defaultTimeoutMs?: number;
}

interface GeminiPart {
  readonly text: string;
}

interface GeminiContent {
  readonly role: 'user' | 'model';
  readonly parts: ReadonlyArray<GeminiPart>;
}

interface GeminiGenerationConfig {
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxOutputTokens?: number;
  readonly stopSequences?: ReadonlyArray<string>;
  readonly responseMimeType?: 'application/json';
}

interface GeminiRequestPayload {
  readonly contents: ReadonlyArray<GeminiContent>;
  readonly systemInstruction?: {
    readonly parts: ReadonlyArray<GeminiPart>;
  };
  readonly generationConfig?: GeminiGenerationConfig;
}

interface GeminiUsageMetadata {
  readonly promptTokenCount?: number;
  readonly candidatesTokenCount?: number;
  readonly totalTokenCount?: number;
}

interface GeminiCandidate {
  readonly finishReason?: string;
  readonly content?: {
    readonly parts?: ReadonlyArray<{ readonly text?: string }>;
  };
}

interface GeminiResponse {
  readonly candidates?: ReadonlyArray<GeminiCandidate>;
  readonly usageMetadata?: GeminiUsageMetadata;
}

const toGeminiRole = (role: 'system' | 'user' | 'assistant'): 'user' | 'model' => {
  return role === 'assistant' ? 'model' : 'user';
};

const toContents = (messages: AIProviderRequest['messages']): GeminiContent[] => {
  const contents: GeminiContent[] = [];
  for (const message of messages) {
    if (message.role === 'system') {
      continue;
    }

    contents.push({
      role: toGeminiRole(message.role),
      parts: [{ text: message.content }],
    });
  }
  return contents;
};

const toSystemInstruction = (
  messages: AIProviderRequest['messages'],
): GeminiRequestPayload['systemInstruction'] | undefined => {
  const systemText = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0)
    .join('\n\n');

  if (systemText.length === 0) {
    return undefined;
  }

  return {
    parts: [{ text: systemText }],
  };
};

const toGenerationConfig = (
  request: AIProviderRequest,
): GeminiGenerationConfig | undefined => {
  const config: GeminiGenerationConfig = {
    temperature: request.temperature,
    topP: request.topP,
    maxOutputTokens: request.maxOutputTokens,
    stopSequences: request.stopSequences,
    responseMimeType: request.responseFormat?.type === 'json_object' ? 'application/json' : undefined,
  };

  if (
    config.temperature === undefined &&
    config.topP === undefined &&
    config.maxOutputTokens === undefined &&
    config.stopSequences === undefined &&
    config.responseMimeType === undefined
  ) {
    return undefined;
  }

  return config;
};

const extractContent = (candidate: GeminiCandidate | undefined): string => {
  const parts = candidate?.content?.parts ?? [];
  return parts
    .filter((part) => typeof part.text === 'string' && part.text.length > 0)
    .map((part) => part.text as string)
    .join('\n')
    .trim();
};

const assertValidResponseFormat = (responseFormat: AIResponseFormat | undefined): void => {
  if (responseFormat === undefined) {
    return;
  }

  if (responseFormat.type === 'text' || responseFormat.type === 'json_object') {
    return;
  }

  throw new AIProviderError('AI_CONFIGURATION_ERROR', 'Unsupported Gemini response format', {
    provider: 'gemini',
    retryable: false,
  });
};

export class GeminiProvider implements AIProvider {
  public readonly provider = 'gemini' as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  public constructor(config: GeminiProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30_000;

    if (this.apiKey.length === 0) {
      throw new AIProviderError('AI_CONFIGURATION_ERROR', 'Gemini API key is required', {
        provider: this.provider,
      });
    }
  }

  public async complete(request: AIProviderRequest, context: AIRequestContext = {}): Promise<AIProviderResponse> {
    assertValidResponseFormat(request.responseFormat);

    return await withRetry(async () => {
      const contents = toContents(request.messages);
      if (contents.length === 0) {
        throw new AIProviderError('AI_RESPONSE_ERROR', 'Gemini request requires at least one user or assistant message', {
          provider: this.provider,
          retryable: false,
        });
      }

      const payload: GeminiRequestPayload = {
        contents,
        systemInstruction: toSystemInstruction(request.messages),
        generationConfig: toGenerationConfig(request),
      };

      const headers = mergeHeaders(
        {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
          'x-idempotency-key': context.idempotencyKey ?? buildIdempotencyKey(this.provider, request),
        },
        context.requestId === undefined ? undefined : { 'x-request-id': context.requestId },
        context.extraHeaders,
      );

      const response = await postJson<GeminiResponse>({
        provider: this.provider,
        method: 'POST',
        url: `${this.baseUrl}/models/${encodeURIComponent(request.model)}:generateContent`,
        headers,
        body: payload,
        timeoutMs: context.timeoutMs ?? this.defaultTimeoutMs,
        signal: context.signal,
      });

      const candidate = response.candidates?.[0];
      const usage = response.usageMetadata;

      return {
        provider: this.provider,
        model: request.model,
        id: context.requestId ?? buildIdempotencyKey(this.provider, request),
        content: extractContent(candidate),
        finishReason: candidate?.finishReason ?? null,
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0),
        },
        raw: response,
      };
    }, context.retryPolicy);
  }
}
