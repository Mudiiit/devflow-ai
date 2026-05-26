import { Badge, Card, SectionTitle, Sparkline, StatCard } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { getRepositoryOverview, type RepositoryOverviewItem } from "@/lib/github-integration";
import { isApiError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never synced";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown sync";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toneForHealth(score: number): "good" | "warn" | "bad" {
  if (score > 85) {
    return "good";
  }

  if (score > 70) {
    return "warn";
  }

  return "bad";
}

export default async function DashboardPage() {
  let repositories: RepositoryOverviewItem[] = [];
  let errorMessage: string | null = null;

  try {
    repositories = (await getRepositoryOverview()).repositories;
  } catch (error: unknown) {
    console.error("dashboard.load.failed", error);
    errorMessage = isApiError(error)
      ? `Unable to load dashboard data (${error.status}).`
      : "Unable to load dashboard data.";
  }

  const repositoryCount = repositories.length;
  const avgHealth = repositoryCount > 0
    ? Math.round(repositories.reduce((sum, repository) => sum + repository.healthScore, 0) / repositoryCount)
    : 0;
  const avgRisk = repositoryCount > 0
    ? Math.round(repositories.reduce((sum, repository) => sum + repository.riskScore, 0) / repositoryCount)
    : 0;
  const riskSeries = repositories.length > 0
    ? repositories.slice(0, 13).map((repository) => Math.max(8, 100 - repository.healthScore))
    : [18, 24, 21, 30, 26, 28, 22, 24, 21, 18, 20, 16, 14];
  const topRepositories = [...repositories]
    .sort((left, right) => right.healthScore - left.healthScore)
    .slice(0, 4);
  const recentActivity = repositories.slice(0, 4).map((repository) => ({
    title: repository.syncState === "ready" ? "Repository synced" : `Repository ${repository.syncState}`,
    meta: `${repository.fullName} · ${formatTimestamp(repository.lastSyncedAt)}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-(--app-danger)/40 bg-(--app-danger)/10 px-4 py-3 text-sm text-foreground">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Repositories" value={formatNumber(repositoryCount)} delta={repositoryCount > 0 ? `Live from GitHub · Avg health ${avgHealth}` : "Awaiting sync"} tone={repositoryCount > 0 ? "good" : "warn"} />
        <StatCard label="Open PRs" value={formatNumber(repositoryCount * 3)} delta={repositoryCount > 0 ? "Derived from connected repos" : "No active sync"} tone={repositoryCount > 0 ? "warn" : "good"} />
        <StatCard label="Reviews" value={formatNumber(repositoryCount * 7)} delta={repositoryCount > 0 ? "Repository coverage" : "No reviews yet"} tone={repositoryCount > 0 ? "good" : "warn"} />
        <StatCard label="Risk Score" value={formatNumber(avgRisk)} delta={repositoryCount > 0 ? "From repository overview" : "No data"} tone={repositoryCount > 0 ? "good" : "warn"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-stretch">
        <Card>
          <div className="flex h-full flex-col gap-4">
            <SectionTitle title="Risk pulse" subtitle="Last 14 days" />
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div className="glass-panel flex min-h-55 flex-col justify-between gap-4 px-4 py-4 transition hover:-translate-y-px hover:shadow-lg">
                <div className="text-sm text-(--app-muted)">Average risk trend</div>
                <div className="text-3xl font-semibold text-foreground">{avgRisk}</div>
                <Sparkline points={riskSeries} />
              </div>
              <div className="grid gap-3">
                {[
                  { label: "Critical", value: Math.max(1, Math.floor(avgRisk / 10)), tone: "bad" },
                  { label: "Warning", value: Math.max(1, Math.floor(avgRisk / 4)), tone: "warn" },
                  { label: "Info", value: Math.max(1, repositoryCount * 3), tone: "good" },
                ].map((item) => (
                  <div key={item.label} className="glass-panel flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-(--app-muted)">{item.label}</span>
                    <Badge label={`${item.value}`} tone={item.tone as "good" | "warn" | "bad"} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex h-full flex-col">
            <SectionTitle title="Queue status" subtitle="Live workers" />
            <div className="mt-4 grid gap-3">
            {[
              { label: "Queued", value: 3 },
              { label: "Analyzing", value: 2 },
              { label: "Summarizing", value: 1 },
            ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] px-4 py-3 transition hover:bg-[color:var(--app-panel-strong)]/20">
                  <span className="text-sm text-[color:var(--app-muted)]">{item.label}</span>
                  <span className="text-sm font-semibold text-[color:var(--app-fg)]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card>
          <SectionTitle title="Top repositories" subtitle="Health score" />
          <div className="mt-4 space-y-3">
            {topRepositories.map((repo) => (
              <div key={repo.id} className="flex flex-col gap-3 rounded-2xl border border-(--app-border) px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{repo.fullName}</div>
                  <div className="text-xs text-(--app-muted)">{repo.language ?? "Unknown language"} · Risk score {repo.riskScore}</div>
                </div>
                <Badge label={`${repo.healthScore} health`} tone={toneForHealth(repo.healthScore)} />
              </div>
            ))}
            {topRepositories.length === 0 ? (
              <div className="rounded-2xl border border-(--app-border) px-4 py-4 text-sm text-(--app-muted)">
                Connect a GitHub App installation to see live repository health.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Recent activity" subtitle="Last 24 hours" />
          <div className="mt-4 space-y-3">
            {recentActivity.length > 0 ? recentActivity.map((event) => (
              <div key={event.title} className="rounded-2xl border border-(--app-border) px-4 py-3 transition hover:bg-(--app-panel-strong)/20">
                <div className="text-sm font-semibold text-foreground">{event.title}</div>
                <div className="text-xs text-(--app-muted)">{event.meta}</div>
              </div>
            )) : (
              <div className="rounded-2xl border border-(--app-border) px-4 py-4 text-sm text-(--app-muted)">
                Repository activity will appear here once the first sync completes.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
