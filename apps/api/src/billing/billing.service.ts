import { Injectable } from '@nestjs/common';
import {
  BillingCustomersRepository,
  InvoicesRepository,
  OrganizationMembershipsRepository,
  OrganizationsRepository,
  PricingPlansRepository,
  RepositoriesRepository,
  SubscriptionsRepository,
  UsageRecordsRepository,
  type BillingCustomer,
  type Invoice,
  type OrganizationMembership,
  type Organization,
  type PricingPlan,
  type Repository,
  type Subscription,
} from '@devflow/database';
import {
  buildQuotaSnapshot,
  defaultBillingPlans,
  type BillingCustomerSummary,
  type BillingInvoiceSummary,
  type BillingPlanSnapshot,
  type BillingSubscriptionSummary,
  type BillingUsageAggregate,
  type BillingUsageEntry,
} from '@devflow/billing';
import { DatabaseBillingProvider } from './billing.provider.js';
import { resolveFrontendOrigin } from '../common/public-origin.js';

type BillingUsageResponse = {
  readonly plan: BillingPlanSnapshot;
  readonly subscription: BillingSubscriptionSummary;
  readonly customer: BillingCustomerSummary;
  readonly resources: readonly BillingUsageAggregate[];
  readonly liveCounts: {
    readonly repositoriesConnected: number;
    readonly activeSeats: number;
    readonly activeUsers: number;
  };
  readonly hardLimitReached: boolean;
  readonly softLimitReached: boolean;
};

type BillingOverviewResponse = {
  readonly subscription: BillingSubscriptionSummary;
  readonly customer: BillingCustomerSummary;
  readonly plan: BillingPlanSnapshot;
  readonly usage: BillingUsageResponse;
  readonly invoices: readonly BillingInvoiceSummary[];
  readonly plans: readonly BillingPlanSnapshot[];
};

type PlanLike = {
  readonly code: string;
  readonly currency: string;
  readonly monthlyPriceCents?: number;
  readonly priceCents?: number;
} | null;

@Injectable()
export class BillingService {
  constructor(
    private readonly billingProvider: DatabaseBillingProvider,
    private readonly billingCustomersRepository: BillingCustomersRepository,
    private readonly pricingPlansRepository: PricingPlansRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly invoicesRepository: InvoicesRepository,
    private readonly usageRecordsRepository: UsageRecordsRepository,
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly organizationMembershipsRepository: OrganizationMembershipsRepository,
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  async getCurrentSubscription(organizationId: string): Promise<BillingOverviewResponse> {
    const plan = await this.ensurePricingPlanForOrganization(organizationId);
    const customer = await this.ensureCustomer(organizationId, plan.currency);
    const subscription = await this.ensureSubscription(organizationId, customer.id, plan.id, plan.code);
    const usage = await this.buildUsageResponse(organizationId, plan, customer, subscription);
    const invoices = await this.billingProvider.listInvoices({ organizationId, customer });
    const plans = await this.billingProvider.listPlans();

    return {
      subscription,
      customer,
      plan,
      usage,
      invoices,
      plans,
    };
  }

  async getUsageStatistics(organizationId: string): Promise<BillingUsageResponse> {
    const plan = await this.ensurePricingPlanForOrganization(organizationId);
    const customer = await this.ensureCustomer(organizationId, plan.currency);
    const subscription = await this.ensureSubscription(organizationId, customer.id, plan.id, plan.code);
    return this.buildUsageResponse(organizationId, plan, customer, subscription);
  }

  async getBillingHistory(organizationId: string): Promise<{ readonly invoices: readonly BillingInvoiceSummary[]; readonly recentUsage: readonly BillingUsageEntry[] }> {
    const customer = await this.ensureCustomer(organizationId, 'usd');
    const invoices = await this.billingProvider.listInvoices({ organizationId, customer });
    const usageRows = await this.usageRecordsRepository.listUsageByOrganization(organizationId);

    return {
      invoices,
      recentUsage: usageRows.map((row) => ({
        resource: row.resource as BillingUsageEntry['resource'],
        quantity: Number(row.quantity ?? 0),
      })),
    };
  }

  async getPricingPlans(): Promise<readonly BillingPlanSnapshot[]> {
    return this.billingProvider.listPlans();
  }

  async createCheckoutSession(organizationId: string, input: { readonly planCode: string; readonly cadence?: 'monthly' | 'annual'; readonly successUrl?: string; readonly cancelUrl?: string }) {
    const plan = await this.ensurePricingPlanForOrganization(organizationId, input.planCode);
    const customer = await this.ensureCustomer(organizationId, plan.currency);
    const subscription = await this.subscriptionsRepository.findByOrganizationId(organizationId);
    const origin = this.resolveAppUrl();

    return this.billingProvider.createCheckoutSession({
      organizationId,
      customer,
      planCode: plan.code,
      cadence: input.cadence ?? 'monthly',
      successUrl: input.successUrl ?? `${origin}/settings/billing`,
      cancelUrl: input.cancelUrl ?? `${origin}/settings/billing`,
      metadata: {
        organizationId,
        planCode: plan.code,
      },
    });
  }

  async changeSubscription(organizationId: string, input: { readonly planCode: string; readonly cadence?: 'monthly' | 'annual'; readonly successUrl?: string; readonly cancelUrl?: string }) {
    const plan = await this.ensurePricingPlanForOrganization(organizationId, input.planCode);
    const customer = await this.ensureCustomer(organizationId, plan.currency);
    const subscription = await this.subscriptionsRepository.findByOrganizationId(organizationId);
    const origin = this.resolveAppUrl();

    const updatedSubscription = await this.billingProvider.changeSubscription({
      organizationId,
      customer,
      subscription: subscription ? this.toSubscriptionSummary(subscription, plan) : null,
      planCode: plan.code,
      cadence: input.cadence ?? 'monthly',
      successUrl: input.successUrl ?? `${origin}/settings/billing`,
      cancelUrl: input.cancelUrl ?? `${origin}/settings/billing`,
    });

    const usage = await this.buildUsageResponse(organizationId, plan, customer, await this.ensureSubscription(organizationId, customer.id, plan.id, plan.code));

    return {
      subscription: updatedSubscription,
      usage,
    };
  }

  async createPortalSession(organizationId: string, returnUrl?: string) {
    const plan = await this.ensurePricingPlanForOrganization(organizationId);
    const customer = await this.ensureCustomer(organizationId, plan.currency);

    return this.billingProvider.createPortalSession({
      organizationId,
      customer,
      returnUrl: returnUrl ?? `${this.resolveAppUrl()}/settings/billing`,
    });
  }

  async handleWebhook(payload: Record<string, unknown>) {
    await this.billingProvider.handleWebhook({
      provider: 'manual',
      type: typeof payload.type === 'string' ? payload.type : 'billing.webhook',
      id: typeof payload.id === 'string' ? payload.id : `billing_event_${Date.now()}`,
      createdAt: new Date().toISOString(),
      payload,
    });
    return { ok: true };
  }

  private async buildUsageResponse(
    organizationId: string,
    plan: BillingPlanSnapshot,
    customer: BillingCustomerSummary,
    subscription: BillingSubscriptionSummary,
  ): Promise<BillingUsageResponse> {
    const since = subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const usageRows = await this.usageRecordsRepository.listUsageByOrganization(organizationId, since);
    const liveRepositories = await this.repositoriesRepository.findManyByOrganizationId(organizationId);
    const liveSeats = await this.organizationMembershipsRepository.findManyByOrganizationId(organizationId);

    const usageEntries: BillingUsageEntry[] = usageRows.map((row) => ({
      resource: row.resource as BillingUsageEntry['resource'],
      quantity: Number(row.quantity ?? 0),
    }));

    usageEntries.push(
      { resource: 'repositories_connected', quantity: liveRepositories.length },
      { resource: 'active_seats', quantity: liveSeats.filter((membership) => membership.status === 'active').length },
    );

    const quota = buildQuotaSnapshot(plan, usageEntries);
    const liveCounts = {
      repositoriesConnected: liveRepositories.length,
      activeSeats: liveSeats.filter((membership) => membership.status === 'active').length,
      activeUsers: new Set(liveSeats.filter((membership) => membership.status === 'active').map((membership) => membership.userId)).size,
    };

    return {
      plan,
      subscription,
      customer,
      resources: quota.resources,
      liveCounts,
      hardLimitReached: quota.resources.some((resource) => resource.status === 'hard'),
      softLimitReached: quota.resources.some((resource) => resource.status !== 'within'),
    };
  }

  private async ensureCustomer(organizationId: string, currency: string): Promise<BillingCustomerSummary> {
    const existing = await this.billingCustomersRepository.findByOrganizationId(organizationId);
    if (existing) {
      return this.toCustomerSummary(existing);
    }

    const organization = await this.organizationsRepository.findById(organizationId);
    const created = await this.billingCustomersRepository.upsertForOrganization({
      organizationId,
      provider: 'manual',
      providerCustomerId: null,
      email: organization?.billingEmail ?? null,
      name: organization?.name ?? null,
      currency,
      metadata: {
        seededFrom: 'organization_lookup',
      },
    });

    return this.toCustomerSummary(created);
  }

  private async ensurePricingPlanForOrganization(organizationId: string, requestedPlanCode?: string): Promise<BillingPlanSnapshot> {
    const plans = await this.billingProvider.listPlans();
    const organization = await this.organizationsRepository.findById(organizationId);
    const requestedCode = requestedPlanCode ?? organization?.plan ?? 'free';
    const selectedPlan = plans.find((plan) => plan.code === requestedCode) ?? plans[0] ?? defaultBillingPlans[0]!;

    const existing = await this.pricingPlansRepository.findByCode(selectedPlan.code);
    if (!existing) {
      await this.pricingPlansRepository.upsertByCode({
        code: selectedPlan.code,
        name: selectedPlan.name,
        description: selectedPlan.description,
        provider: 'manual',
        providerProductId: null,
        providerPriceId: null,
        cadence: selectedPlan.cadence,
        currency: selectedPlan.currency,
        monthlyPriceCents: selectedPlan.priceCents,
        annualPriceCents: selectedPlan.priceCents <= 0 ? 0 : Math.round(selectedPlan.priceCents * 10),
        quotaRules: selectedPlan.quota,
        featured: selectedPlan.featured,
        active: selectedPlan.active,
        sortOrder: plans.findIndex((plan) => plan.code === selectedPlan.code),
        metadata: {
          seededFrom: 'billing_service',
        },
      });
    }

    return selectedPlan;
  }

  private async ensureSubscription(organizationId: string, customerId: string, pricingPlanId: string, planCode: string): Promise<BillingSubscriptionSummary> {
    const existing = await this.subscriptionsRepository.findByOrganizationId(organizationId);
    if (existing) {
      const plan = await this.pricingPlansRepository.findById(existing.pricingPlanId ?? pricingPlanId);
      return this.toSubscriptionSummary(existing, plan ?? null);
    }

    const now = new Date();
    const plan = await this.pricingPlansRepository.findById(pricingPlanId);
    const created = await this.subscriptionsRepository.upsertCurrent({
      organizationId,
      billingCustomerId: customerId,
      pricingPlanId,
      provider: 'manual',
      providerSubscriptionId: `sub_${organizationId}`,
      status: 'trialing',
      cadence: plan?.cadence ?? 'monthly',
      quantitySeats: 1,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      metadata: {
        seededFrom: 'billing_service',
      },
    });

    await this.organizationsRepository.updateById(organizationId, {
      plan: planCode as 'free' | 'team' | 'enterprise',
    });

    return this.toSubscriptionSummary(created, plan ?? null);
  }

  private resolveAppUrl(): string {
    return resolveFrontendOrigin();
  }

  private toSubscriptionSummary(subscription: Subscription, plan: PlanLike): BillingSubscriptionSummary {
    return {
      id: subscription.id,
      organizationId: subscription.organizationId,
      provider: subscription.provider as BillingSubscriptionSummary['provider'],
      status: subscription.status as BillingSubscriptionSummary['status'],
      planCode: plan?.code ?? 'free',
      cadence: subscription.cadence as BillingSubscriptionSummary['cadence'],
      priceCents: plan?.monthlyPriceCents ?? plan?.priceCents ?? 0,
      currency: plan?.currency ?? 'usd',
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  private toCustomerSummary(customer: BillingCustomer): BillingCustomerSummary {
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
}