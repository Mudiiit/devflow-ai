import { Badge, Card, SectionTitle, StatCard, Sparkline } from "@/components/ui";
import { BillingActionButton } from "@/components/BillingActionButton";
import { fetchApi } from "@/lib/api";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BillingUsageResource = {
  readonly resource: string;
  readonly quantity: number;
  readonly limit: number;
  readonly softLimit: number;
  readonly hardLimit: number;
  readonly unit: string;
  readonly status: "within" | "soft" | "hard";
};

type BillingPlan = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly cadence: "monthly" | "annual";
  readonly currency: string;
  readonly priceCents: number;
  readonly quota: ReadonlyArray<{ readonly resource: string; readonly included: number; readonly softLimit: number; readonly hardLimit: number; readonly unit: string }>;
  readonly featured: boolean;
  readonly active: boolean;
};

type BillingOverview = {
  readonly subscription: {
    readonly planCode: string;
    readonly cadence: "monthly" | "annual";
    readonly priceCents: number;
    readonly currency: string;
    readonly status: string;
    readonly currentPeriodEnd: string | null;
  };
  readonly customer: {
    readonly name: string | null;
    readonly email: string | null;
  };
  readonly plan: BillingPlan;
  readonly usage: {
    readonly plan: BillingPlan;
    readonly liveCounts: {
      readonly repositoriesConnected: number;
      readonly activeSeats: number;
      readonly activeUsers: number;
    };
    readonly hardLimitReached: boolean;
    readonly softLimitReached: boolean;
    readonly resources: readonly BillingUsageResource[];
  };
  readonly invoices: ReadonlyArray<{
    readonly id: string;
    readonly invoiceNumber: string;
    readonly status: string;
    readonly currency: string;
    readonly totalCents: number;
    readonly amountDueCents: number;
    readonly issuedAt: string | null;
    readonly hostedInvoiceUrl: string | null;
  }>;
  readonly plans: readonly BillingPlan[];
};

const formatMoney = (currency: string, valueCents: number): string => new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: currency.toUpperCase(),
  maximumFractionDigits: 0,
}).format(valueCents / 100);

const formatDate = (value: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

function usageSeries(resources: readonly BillingUsageResource[]): number[] {
  return resources.map((resource) => {
    const limit = Math.max(resource.hardLimit, 1);
    return Math.min(100, Math.round((resource.quantity / limit) * 100));
  });
}

export default async function BillingSettingsPage() {
  const overview = await fetchApi<BillingOverview>("/billing/subscription");
  const currentPlan = overview.plan;
  const isCurrentPlan = (planCode: string) => planCode === overview.subscription.planCode;
  const series = usageSeries(overview.usage.resources);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Current plan"
          value={currentPlan.name}
          delta={formatMoney(currentPlan.currency, overview.subscription.priceCents)}
          tone="good"
        />
        <StatCard
          label="Repos connected"
          value={formatNumber(overview.usage.liveCounts.repositoriesConnected)}
          delta="Live workspace total"
          tone="good"
        />
        <StatCard
          label="Active seats"
          value={formatNumber(overview.usage.liveCounts.activeSeats)}
          delta="Members with access"
          tone={overview.usage.softLimitReached ? "warn" : "good"}
        />
        <StatCard
          label="API calls"
          value={formatNumber(overview.usage.resources.find((resource) => resource.resource === "api_calls")?.quantity ?? 0)}
          delta="This billing period"
          tone={overview.usage.hardLimitReached ? "bad" : "good"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card>
          <div className="flex flex-col gap-4">
            <SectionTitle title="Usage and quotas" subtitle="Current billing period" />
            <div className="glass-panel px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Plan usage</div>
                  <div className="mt-1 text-xl font-semibold text-[color:var(--app-fg)]">{currentPlan.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={overview.usage.hardLimitReached ? "Hard limit reached" : overview.usage.softLimitReached ? "Soft limit" : "Healthy"} tone={overview.usage.hardLimitReached ? "bad" : overview.usage.softLimitReached ? "warn" : "good"} />
                  <BillingActionButton
                    label="Open portal"
                    endpoint="/billing/portal"
                    payload={{}}
                    tone="secondary"
                  />
                </div>
              </div>
              <div className="mt-4 h-10 w-full overflow-hidden rounded-full bg-[color:var(--app-panel-strong)]">
                <div className="h-full bg-[linear-gradient(90deg,var(--app-accent),var(--app-accent-2))]" style={{ width: `${series.length > 0 ? series.reduce((total, value) => total + value, 0) / series.length : 0}%` }} />
              </div>
              <div className="mt-2 text-xs text-[color:var(--app-muted)]">Average quota utilization across tracked resources</div>
              <Sparkline points={series.length > 0 ? series : [0, 0, 0, 0]} />
            </div>

            <div className="grid gap-3">
              {overview.usage.resources.map((resource) => {
                const width = Math.min(100, Math.round((resource.quantity / Math.max(resource.hardLimit, 1)) * 100));
                return (
                  <div key={resource.resource} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-4 transition hover:bg-[color:var(--app-panel-strong)]/25">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[color:var(--app-fg)]">{resource.resource.replaceAll("_", " ")}</div>
                        <div className="text-xs text-[color:var(--app-muted)]">{formatNumber(resource.quantity)} {resource.unit} used of {formatNumber(resource.limit)} included</div>
                      </div>
                      <Badge label={resource.status === "hard" ? "Hard" : resource.status === "soft" ? "Soft" : "Within"} tone={resource.status === "hard" ? "bad" : resource.status === "soft" ? "warn" : "good"} />
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--app-panel-strong)]">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--app-accent),var(--app-accent-2))]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Workspace summary" subtitle="Seats and billing contact" />
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 transition hover:bg-[color:var(--app-panel-strong)]/25">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Billing contact</div>
                <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">{overview.customer.name ?? overview.customer.email ?? "Unassigned"}</div>
              </div>
              <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 transition hover:bg-[color:var(--app-panel-strong)]/25">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Active users</div>
                <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">{formatNumber(overview.usage.liveCounts.activeUsers)}</div>
              </div>
              <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 transition hover:bg-[color:var(--app-panel-strong)]/25">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Renewal</div>
                <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">{formatDate(overview.subscription.currentPeriodEnd)}</div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Billing history" subtitle="Recent invoices" />
            <div className="mt-4 space-y-3">
              {overview.invoices.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-8 text-center text-sm text-[color:var(--app-muted)]">
                  No invoices yet.
                </div>
              ) : null}
              {overview.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 transition hover:bg-[color:var(--app-panel-strong)]/25">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--app-fg)]">{invoice.invoiceNumber}</div>
                      <div className="text-xs text-[color:var(--app-muted)]">{formatDate(invoice.issuedAt)}</div>
                    </div>
                    <Badge label={invoice.status} tone={invoice.status === "paid" ? "good" : invoice.status === "open" ? "warn" : "neutral"} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-[color:var(--app-muted)]">
                    <span>{formatMoney(invoice.currency, invoice.totalCents)}</span>
                    <span>{invoice.amountDueCents > 0 ? `${formatMoney(invoice.currency, invoice.amountDueCents)} due` : "Paid"}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <SectionTitle title="Plans" subtitle="Upgrade or downgrade" />
          <div className="grid gap-4 lg:grid-cols-3" id="plans">
            {overview.plans.map((plan) => (
              <div
                key={plan.id}
                className={[
                  "rounded-3xl border px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-lg",
                  plan.code === overview.subscription.planCode
                    ? "border-[color:var(--app-accent)] bg-[linear-gradient(180deg,var(--app-panel),var(--app-panel-strong))]"
                    : "border-[color:var(--app-border)] bg-[color:var(--app-panel)]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-[color:var(--app-fg)]">{plan.name}</div>
                    <div className="text-sm text-[color:var(--app-muted)]">{plan.description}</div>
                  </div>
                  {plan.featured ? <Badge label="Popular" tone="good" /> : null}
                </div>
                <div className="mt-4 text-3xl font-semibold text-[color:var(--app-fg)]">
                  {plan.priceCents === 0 ? "Free" : formatMoney(plan.currency, plan.priceCents)}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">per month</div>
                <div className="mt-4 space-y-2">
                  {plan.quota.slice(0, 4).map((quota) => (
                    <div key={quota.resource} className="flex items-center justify-between text-sm text-[color:var(--app-muted)]">
                      <span>{quota.resource.replaceAll("_", " ")}</span>
                      <span className="font-semibold text-[color:var(--app-fg)]">{formatNumber(quota.included)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-3">
                  {isCurrentPlan(plan.code) ? (
                    <Badge label="Current plan" tone="good" />
                  ) : (
                    <BillingActionButton
                      label={plan.priceCents > overview.subscription.priceCents ? "Upgrade" : "Downgrade"}
                      endpoint="/billing/subscription/change"
                      payload={{ planCode: plan.code, cadence: plan.cadence }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}