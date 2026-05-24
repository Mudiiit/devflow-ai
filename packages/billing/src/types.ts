export const billingProviderNames = ['manual', 'stripe'] as const;

export type BillingProviderName = (typeof billingProviderNames)[number];

export const billingCadences = ['monthly', 'annual'] as const;

export type BillingCadence = (typeof billingCadences)[number];

export const billingSubscriptionStatuses = [
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'incomplete',
  'unpaid',
] as const;

export type BillingSubscriptionStatus = (typeof billingSubscriptionStatuses)[number];

export const billingInvoiceStatuses = ['draft', 'open', 'paid', 'void', 'uncollectible', 'refunded'] as const;

export type BillingInvoiceStatus = (typeof billingInvoiceStatuses)[number];

export const billingUsageResources = [
  'ai_review_request',
  'tokens_consumed',
  'repositories_connected',
  'prs_reviewed',
  'api_calls',
  'storage_usage_bytes',
  'active_seats',
] as const;

export type BillingUsageResource = (typeof billingUsageResources)[number];

export const billingUsageUnits = ['count', 'tokens', 'bytes', 'seats'] as const;

export type BillingUsageUnit = (typeof billingUsageUnits)[number];

export const billingUsageSources = ['api', 'worker', 'webhook', 'manual', 'system'] as const;

export type BillingUsageSource = (typeof billingUsageSources)[number];

export interface BillingPlanQuota {
  readonly resource: BillingUsageResource;
  readonly included: number;
  readonly softLimit: number;
  readonly hardLimit: number;
  readonly unit: BillingUsageUnit;
}

export interface BillingPlanSnapshot {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly cadence: BillingCadence;
  readonly currency: string;
  readonly priceCents: number;
  readonly quota: readonly BillingPlanQuota[];
  readonly featured: boolean;
  readonly active: boolean;
}

export interface BillingUsageAggregate {
  readonly resource: BillingUsageResource;
  readonly quantity: number;
  readonly limit: number;
  readonly softLimit: number;
  readonly hardLimit: number;
  readonly unit: BillingUsageUnit;
  readonly status: 'within' | 'soft' | 'hard';
}

export interface BillingQuotaSnapshot {
  readonly planCode: string;
  readonly cadence: BillingCadence;
  readonly resources: ReadonlyArray<BillingUsageAggregate>;
}

export interface BillingSubscriptionSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: BillingProviderName;
  readonly status: BillingSubscriptionStatus;
  readonly planCode: string;
  readonly cadence: BillingCadence;
  readonly priceCents: number;
  readonly currency: string;
  readonly currentPeriodStart: string | null;
  readonly currentPeriodEnd: string | null;
  readonly trialEndsAt: string | null;
  readonly cancelAtPeriodEnd: boolean;
}

export interface BillingInvoiceSummary {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly status: BillingInvoiceStatus;
  readonly currency: string;
  readonly subtotalCents: number;
  readonly totalCents: number;
  readonly amountPaidCents: number;
  readonly amountDueCents: number;
  readonly issuedAt: string | null;
  readonly dueAt: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly hostedInvoiceUrl: string | null;
  readonly invoicePdfUrl: string | null;
}

export interface BillingCustomerSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: BillingProviderName;
  readonly providerCustomerId: string | null;
  readonly email: string | null;
  readonly name: string | null;
  readonly currency: string;
}

export interface BillingPlanDefinition extends BillingPlanSnapshot {
  readonly sortOrder: number;
  readonly popular: boolean;
  readonly providerProductId: string | null;
  readonly providerPriceId: string | null;
}