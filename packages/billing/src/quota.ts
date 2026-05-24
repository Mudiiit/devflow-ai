import type {
  BillingPlanQuota,
  BillingPlanSnapshot,
  BillingQuotaSnapshot,
  BillingUsageAggregate,
  BillingUsageResource,
} from './types.js';

export interface BillingUsageEntry {
  readonly resource: BillingUsageResource;
  readonly quantity: number;
}

const resourceRank = (quota: BillingPlanQuota): number => quota.hardLimit - quota.softLimit;

function chooseQuota(quota: readonly BillingPlanQuota[], resource: BillingUsageResource): BillingPlanQuota {
  const match = quota.find((entry) => entry.resource === resource);

  if (!match) {
    return {
      resource,
      included: 0,
      softLimit: 0,
      hardLimit: 0,
      unit: 'count',
    };
  }

  return match;
}

export function buildQuotaSnapshot(plan: BillingPlanSnapshot, usage: readonly BillingUsageEntry[]): BillingQuotaSnapshot {
  const usageMap = new Map<BillingUsageResource, number>();

  for (const entry of usage) {
    usageMap.set(entry.resource, (usageMap.get(entry.resource) ?? 0) + entry.quantity);
  }

  const resources = plan.quota
    .slice()
    .sort((left, right) => resourceRank(right) - resourceRank(left))
    .map<BillingUsageAggregate>((quota) => {
      const resolvedQuota = chooseQuota(plan.quota, quota.resource);
      const quantity = usageMap.get(quota.resource) ?? 0;
      const status = quantity >= resolvedQuota.hardLimit ? 'hard' : quantity >= resolvedQuota.softLimit ? 'soft' : 'within';

      return {
        resource: resolvedQuota.resource,
        quantity,
        limit: resolvedQuota.included,
        softLimit: resolvedQuota.softLimit,
        hardLimit: resolvedQuota.hardLimit,
        unit: resolvedQuota.unit,
        status,
      };
    });

  return {
    planCode: plan.code,
    cadence: plan.cadence,
    resources,
  };
}

export function getQuotaState(resource: BillingUsageAggregate): 'within' | 'soft' | 'hard' {
  return resource.status;
}

export function isHardLimitReached(snapshot: BillingQuotaSnapshot): boolean {
  return snapshot.resources.some((resource) => resource.status === 'hard');
}

export function isSoftLimitReached(snapshot: BillingQuotaSnapshot): boolean {
  return snapshot.resources.some((resource) => resource.status === 'soft' || resource.status === 'hard');
}