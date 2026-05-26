import { Injectable } from '@nestjs/common';
import { FeatureFlagsRepository } from '@devflow/database';
import { evaluateFeatureFlag } from '@devflow/feature-flags';

@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly featureFlagsRepository: FeatureFlagsRepository,
  ) {}

  async isEnabled(
    key: string,
    context: {
      organizationId?: string | null;
      actorId?: string | null;
      attributes?: Record<string, unknown>;
    } = {},
  ): Promise<boolean> {
    const orgFlag = context.organizationId
      ? await this.featureFlagsRepository.findByKey(key, context.organizationId)
      : null;
    const defaultFlag = await this.featureFlagsRepository.findByKey(key, null);
    const flag = orgFlag ?? defaultFlag;

    if (!flag) {
      return false;
    }

    return evaluateFeatureFlag(
      {
        key: flag.key,
        enabled: flag.enabled,
        rolloutPercent: flag.rolloutPercent,
        rules: flag.rules,
      },
      {
        actorId: context.actorId ?? undefined,
        attributes: context.attributes,
      },
    );
  }
}
