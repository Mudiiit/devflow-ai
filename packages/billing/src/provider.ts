import type {
  BillingCadence,
  BillingCustomerSummary,
  BillingInvoiceSummary,
  BillingPlanSnapshot,
  BillingProviderName,
  BillingSubscriptionSummary,
} from './types.js';

export interface BillingCheckoutSessionInput {
  readonly organizationId: string;
  readonly customer: BillingCustomerSummary | null;
  readonly planCode: string;
  readonly cadence: BillingCadence;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface BillingCheckoutSession {
  readonly id: string;
  readonly provider: BillingProviderName;
  readonly url: string;
  readonly status: 'open' | 'completed' | 'expired';
  readonly expiresAt: string | null;
}

export interface BillingPortalSessionInput {
  readonly organizationId: string;
  readonly customer: BillingCustomerSummary;
  readonly returnUrl: string;
}

export interface BillingPortalSession {
  readonly id: string;
  readonly provider: BillingProviderName;
  readonly url: string;
}

export interface BillingProviderWebhookEvent {
  readonly provider: BillingProviderName;
  readonly type: string;
  readonly id: string;
  readonly createdAt: string;
  readonly payload: Record<string, unknown>;
}

export interface BillingPlanChangeInput {
  readonly organizationId: string;
  readonly customer: BillingCustomerSummary | null;
  readonly subscription: BillingSubscriptionSummary | null;
  readonly planCode: string;
  readonly cadence: BillingCadence;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface BillingProvider {
  readonly name: BillingProviderName;
  listPlans(): Promise<readonly BillingPlanSnapshot[]>;
  createCheckoutSession(input: BillingCheckoutSessionInput): Promise<BillingCheckoutSession>;
  createPortalSession(input: BillingPortalSessionInput): Promise<BillingPortalSession>;
  changeSubscription(input: BillingPlanChangeInput): Promise<BillingSubscriptionSummary>;
  listInvoices(input: { readonly organizationId: string; readonly customer: BillingCustomerSummary | null }): Promise<readonly BillingInvoiceSummary[]>;
  handleWebhook(event: BillingProviderWebhookEvent): Promise<void>;
}