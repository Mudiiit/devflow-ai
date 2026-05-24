export interface FeatureFlagDefinition {
  key: string;
  enabled: boolean;
  rolloutPercent?: number;
  rules?: Record<string, unknown>;
}

export interface FeatureEvaluationContext {
  actorId?: string;
  attributes?: Record<string, unknown>;
}

const computeStableBucket = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  const normalized = Math.abs(hash % 100);
  return normalized;
};

export const evaluateFeatureFlag = (
  definition: FeatureFlagDefinition,
  context: FeatureEvaluationContext = {},
): boolean => {
  if (!definition.enabled) {
    return false;
  }

  const rollout = Math.max(0, Math.min(100, definition.rolloutPercent ?? 100));
  if (rollout >= 100) {
    return true;
  }

  const actorSeed = context.actorId ?? JSON.stringify(context.attributes ?? {});
  if (actorSeed.length === 0) {
    return false;
  }

  return computeStableBucket(`${definition.key}:${actorSeed}`) < rollout;
};
