import { createHash } from 'node:crypto';

import type { AIProviderName, AIProviderRequest } from './types.js';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const values = value.map((entry) => stableStringify(entry));
    return `[${values.join(',')}]`;
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort((left, right) => left.localeCompare(right));
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`);
  return `{${pairs.join(',')}}`;
};

export const buildIdempotencyKey = (provider: AIProviderName, request: AIProviderRequest): string => {
  const payload = stableStringify({ provider, request });
  const digest = createHash('sha256').update(payload).digest('hex');
  return `${provider}-${digest}`;
};

export const mergeHeaders = (
  ...headers: ReadonlyArray<Readonly<Record<string, string>> | undefined>
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const source of headers) {
    if (source === undefined) {
      continue;
    }
    for (const [key, value] of Object.entries(source)) {
      result[key] = value;
    }
  }
  return result;
};
