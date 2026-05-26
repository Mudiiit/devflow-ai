import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BillingCustomersRepository,
  InvoicesRepository,
  OrganizationsRepository,
  PricingPlansRepository,
  SubscriptionsRepository,
  type BillingCustomer,
  type Invoice,
  type PricingPlan,
  type Subscription,
} from '@devflow/database';
import { resolveFrontendOrigin } from '../common/public-origin.js';
import {
  defaultBillingPlans,
  type BillingCadence,
  type BillingCheckoutSession,
  type BillingCheckoutSessionInput,
  type BillingCustomerSummary,
  type BillingInvoiceSummary,
  type BillingPlanChangeInput,
  type BillingPlanSnapshot,
  type BillingPortalSession,
  type BillingPortalSessionInput,
  type BillingProvider,
  type BillingProviderWebhookEvent,
  type BillingSubscriptionSummary,
  type BillingUsageAggregate,
} from '@devflow/billing';
import { eq } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../database/database.constants.js';

const monthsForCadence = (cadence: BillingCadence): number =>
  cadence === 'annual' ? 12 : 1;

function resolveAnnualPrice(monthlyPriceCents: number): number {
  return monthlyPriceCents <= 0 ? 0 : Math.round(monthlyPriceCents * 10);
}

function toPlanRowDefinition(plan: BillingPlanSnapshot) {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    provider: 'manual' as const,
    providerProductId: null,
    providerPriceId: null,
    cadence: plan.cadence,
    currency: plan.currency,
    monthlyPriceCents: plan.priceCents,
    annualPriceCents: resolveAnnualPrice(plan.priceCents),
    quotaRules: plan.quota,
    featured: plan.featured,
    active: plan.active,
    sortOrder: defaultBillingPlans.findIndex(
      (entry) => entry.code === plan.code,
    ),
    metadata: {
      seededFrom: 'default_billing_plans',
      sortOrder: defaultBillingPlans.findIndex(
        (entry) => entry.code === plan.code,
      ),
      popular:
        defaultBillingPlans.find((entry) => entry.code === plan.code)
          ?.popular ?? false,
    },
  };
}

function toBillingPlanSnapshot(plan: PricingPlan): BillingPlanSnapshot {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    cadence: plan.cadence as BillingCadence,
    currency: plan.currency,
    priceCents: plan.monthlyPriceCents,
    quota: plan.quotaRules,
    featured: plan.featured,
    active: plan.active,
  };
}

function toCustomerSummary(customer: BillingCustomer): BillingCustomerSummary {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    provider: customer.provider as BillingCustomerSummary['provider'],
    providerCustomerId: customer.providerCustomerId ?? null,
    email: customer.email ?? null,
    name: customer.name ?? null,
    currency: customer.currency,
  };
}

function toSubscriptionSummary(
  subscription: Subscription,
  plan: PricingPlan | null,
): BillingSubscriptionSummary {
  return {
    id: subscription.id,
    organizationId: subscription.organizationId,
    provider: subscription.provider as BillingSubscriptionSummary['provider'],
    status: subscription.status as BillingSubscriptionSummary['status'],
    planCode: plan?.code ?? 'free',
    cadence: subscription.cadence as BillingCadence,
    priceCents: plan?.monthlyPriceCents ?? 0,
    currency: plan?.currency ?? 'usd',
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

function toInvoiceSummary(invoice: Invoice): BillingInvoiceSummary {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status as BillingInvoiceSummary['status'],
    currency: invoice.currency,
    subtotalCents: invoice.subtotalCents,
    totalCents: invoice.totalCents,
    amountPaidCents: invoice.amountPaidCents,
    amountDueCents: invoice.amountDueCents,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    periodStart: invoice.periodStart?.toISOString() ?? null,
    periodEnd: invoice.periodEnd?.toISOString() ?? null,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl ?? null,
    invoicePdfUrl: invoice.invoicePdfUrl ?? null,
  };
}

@Injectable()
export class DatabaseBillingProvider implements BillingProvider {
  readonly name = 'manual' as const;

  constructor(
    private readonly billingCustomersRepository: BillingCustomersRepository,
    private readonly pricingPlansRepository: PricingPlansRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly invoicesRepository: InvoicesRepository,
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  async listPlans(): Promise<readonly BillingPlanSnapshot[]> {
    const plans = await this.pricingPlansRepository.findActivePlans();

    if (plans.length === 0) {
      for (const plan of defaultBillingPlans) {
        await this.pricingPlansRepository.upsertByCode(
          toPlanRowDefinition(plan),
        );
      }

      return defaultBillingPlans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        cadence: plan.cadence,
        currency: plan.currency,
        priceCents: plan.priceCents,
        quota: plan.quota,
        featured: plan.featured,
        active: plan.active,
      }));
    }

    return plans.map(toBillingPlanSnapshot);
  }

  async createCheckoutSession(
    input: BillingCheckoutSessionInput,
  ): Promise<BillingCheckoutSession> {
    const sessionId = `checkout_${randomUUID()}`;
    const url = new URL(input.successUrl);
    url.searchParams.set('billing_session', sessionId);
    url.searchParams.set('billing_plan', input.planCode);
    url.searchParams.set('billing_cadence', input.cadence);

    return {
      id: sessionId,
      provider: this.name,
      url: url.toString(),
      status: 'open',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async createPortalSession(
    input: BillingPortalSessionInput,
  ): Promise<BillingPortalSession> {
    const sessionId = `portal_${randomUUID()}`;
    const url = new URL(input.returnUrl);
    url.searchParams.set('billing_portal', sessionId);
    return {
      id: sessionId,
      provider: this.name,
      url: url.toString(),
    };
  }

  async changeSubscription(
    input: BillingPlanChangeInput,
  ): Promise<BillingSubscriptionSummary> {
    const plans = await this.pricingPlansRepository.findActivePlans();
    if (plans.length === 0) {
      await this.listPlans();
    }

    const planRow =
      (await this.pricingPlansRepository.findByCode(input.planCode)) ??
      (await this.pricingPlansRepository.findByCode('free'));
    const plan = planRow ?? null;
    if (!plan) {
      throw new Error(`Pricing plan ${input.planCode} is not available`);
    }

    const customer =
      input.customer ??
      (await this.billingCustomersRepository.upsertForOrganization({
        organizationId: input.organizationId,
        provider: this.name,
        providerCustomerId: null,
        email: null,
        name: null,
        currency: plan.currency,
        metadata: { source: 'billing_change_subscription' },
      }));

    const now = new Date();
    const currentPeriodEnd = new Date(
      now.getTime() +
        monthsForCadence(input.cadence) * 30 * 24 * 60 * 60 * 1000,
    );
    const monthlyPriceCents = plan.monthlyPriceCents;
    const subscription = await this.subscriptionsRepository.upsertCurrent({
      organizationId: input.organizationId,
      billingCustomerId: customer.id,
      pricingPlanId: plan.id,
      provider: this.name,
      providerSubscriptionId: `sub_${input.organizationId}`,
      status: monthlyPriceCents > 0 ? 'active' : 'trialing',
      cadence: input.cadence,
      quantitySeats: 1,
      currentPeriodStart: now,
      currentPeriodEnd,
      trialEndsAt: monthlyPriceCents === 0 ? currentPeriodEnd : null,
      cancelAtPeriodEnd: false,
      metadata: {
        changedFrom: input.subscription?.planCode ?? null,
        requestedAt: now.toISOString(),
      },
    });

    await this.organizationsRepository.updateById(input.organizationId, {
      plan: plan.code as 'free' | 'team' | 'enterprise',
    });

    const invoice = await this.invoicesRepository.upsertByProviderInvoiceId({
      organizationId: input.organizationId,
      billingCustomerId: customer.id,
      subscriptionId: subscription.id,
      provider: this.name,
      providerInvoiceId: `inv_${input.organizationId}_${Date.now()}`,
      invoiceNumber: `DF-${Date.now()}`,
      status: monthlyPriceCents > 0 ? 'open' : 'paid',
      currency: plan.currency,
      subtotalCents: monthlyPriceCents,
      taxCents: 0,
      totalCents: monthlyPriceCents,
      amountPaidCents: monthlyPriceCents > 0 ? 0 : monthlyPriceCents,
      amountDueCents: monthlyPriceCents,
      issuedAt: now,
      dueAt: currentPeriodEnd,
      periodStart: now,
      periodEnd: currentPeriodEnd,
      hostedInvoiceUrl: input.successUrl,
      invoicePdfUrl: null,
      metadata: {
        planCode: plan.code,
        cadence: input.cadence,
        subscriptionProvider: this.name,
      },
    });

    void invoice;

    return toSubscriptionSummary(subscription, plan);
  }

  async listInvoices(input: {
    readonly organizationId: string;
    readonly customer: BillingCustomerSummary | null;
  }): Promise<readonly BillingInvoiceSummary[]> {
    const invoices = await this.invoicesRepository.findByOrganizationId(
      input.organizationId,
    );
    return invoices.map(toInvoiceSummary);
  }

  async handleWebhook(event: BillingProviderWebhookEvent): Promise<void> {
    if (
      event.type === 'billing.subscription.updated' ||
      event.type === 'billing.subscription.created'
    ) {
      const organizationId =
        typeof event.payload.organizationId === 'string'
          ? event.payload.organizationId
          : null;
      const planCode =
        typeof event.payload.planCode === 'string'
          ? event.payload.planCode
          : null;
      const cadence = event.payload.cadence === 'annual' ? 'annual' : 'monthly';

      if (organizationId && planCode) {
        const origin = resolveFrontendOrigin();

        await this.changeSubscription({
          organizationId,
          customer: null,
          subscription: null,
          planCode,
          cadence,
          successUrl: `${origin}/settings/billing`,
          cancelUrl: `${origin}/settings/billing`,
        });
      }
    }

    if (event.type === 'billing.invoice.paid') {
      const providerInvoiceId =
        typeof event.payload.providerInvoiceId === 'string'
          ? event.payload.providerInvoiceId
          : null;
      const invoiceNumber =
        typeof event.payload.invoiceNumber === 'string'
          ? event.payload.invoiceNumber
          : `WEBHOOK-${event.id}`;

      if (providerInvoiceId) {
        await this.invoicesRepository.upsertByProviderInvoiceId({
          organizationId:
            typeof event.payload.organizationId === 'string'
              ? event.payload.organizationId
              : '',
          billingCustomerId: null,
          subscriptionId: null,
          provider: this.name,
          providerInvoiceId,
          invoiceNumber,
          status: 'paid',
          currency:
            typeof event.payload.currency === 'string'
              ? event.payload.currency
              : 'usd',
          subtotalCents:
            typeof event.payload.subtotalCents === 'number'
              ? event.payload.subtotalCents
              : 0,
          taxCents:
            typeof event.payload.taxCents === 'number'
              ? event.payload.taxCents
              : 0,
          totalCents:
            typeof event.payload.totalCents === 'number'
              ? event.payload.totalCents
              : 0,
          amountPaidCents:
            typeof event.payload.amountPaidCents === 'number'
              ? event.payload.amountPaidCents
              : 0,
          amountDueCents: 0,
          issuedAt: new Date(event.createdAt),
          dueAt: null,
          periodStart: null,
          periodEnd: null,
          hostedInvoiceUrl:
            typeof event.payload.hostedInvoiceUrl === 'string'
              ? event.payload.hostedInvoiceUrl
              : null,
          invoicePdfUrl:
            typeof event.payload.invoicePdfUrl === 'string'
              ? event.payload.invoicePdfUrl
              : null,
          metadata: event.payload,
        });
      }
    }
  }
}
