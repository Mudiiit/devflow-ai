import { AnthropicProvider, type AnthropicProviderConfig } from './anthropic/index.js';
import { GeminiProvider, type GeminiProviderConfig } from './gemini/index.js';
import { OpenAIProvider, type OpenAIProviderConfig } from './openai/index.js';
import type { AIProvider, AIProviderName } from './types.js';

export interface AIProviderConfigMap {
  readonly openai: OpenAIProviderConfig;
  readonly anthropic: AnthropicProviderConfig;
  readonly gemini: GeminiProviderConfig;
}

export const createAIProvider = <TProviderName extends AIProviderName>(
  provider: TProviderName,
  config: AIProviderConfigMap[TProviderName],
): AIProvider => {
  if (provider === 'openai') {
    return new OpenAIProvider(config as AIProviderConfigMap['openai']);
  }

  if (provider === 'anthropic') {
    return new AnthropicProvider(config as AIProviderConfigMap['anthropic']);
  }

  return new GeminiProvider(config as AIProviderConfigMap['gemini']);
};
