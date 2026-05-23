export type AIProviderName = 'openai' | 'anthropic' | 'gemini';

export type AIRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  readonly role: AIRole;
  readonly content: string;
}

export interface AIResponseFormatText {
  readonly type: 'text';
}

export interface AIResponseFormatJsonObject {
  readonly type: 'json_object';
}

export type AIResponseFormat = AIResponseFormatText | AIResponseFormatJsonObject;

export interface AIProviderRequest {
  readonly model: string;
  readonly messages: ReadonlyArray<AIMessage>;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly topP?: number;
  readonly stopSequences?: ReadonlyArray<string>;
  readonly responseFormat?: AIResponseFormat;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface AIUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface AIProviderResponse {
  readonly provider: AIProviderName;
  readonly model: string;
  readonly id: string;
  readonly content: string;
  readonly finishReason: string | null;
  readonly usage: AIUsage;
  readonly raw: unknown;
}

export interface AIRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly jitterRatio: number;
  readonly retryableStatusCodes: ReadonlySet<number>;
}

export interface AIRequestContext {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly idempotencyKey?: string;
  readonly requestId?: string;
  readonly retryPolicy?: Partial<AIRetryPolicy>;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}

export interface AIProvider {
  readonly provider: AIProviderName;
  complete(request: AIProviderRequest, context?: AIRequestContext): Promise<AIProviderResponse>;
}
