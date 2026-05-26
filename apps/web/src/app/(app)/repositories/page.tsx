import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { getGitHubInstallationUrl, getRepositoryOverview, type RepositoryOverviewItem } from "@/lib/github-integration";

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

function toneForRisk(score: number): "good" | "warn" | "bad" {
  if (score < 20) {
    return "good";
  }

  if (score < 40) {
    return "warn";
  }

  return "bad";
}

export default async function RepositoriesPage() {
  let repositories: RepositoryOverviewItem[] = [];
  let installationUrl: string | null = null;
  let errorMessage: string | null = null;

  try {
    const [overview, installUrl] = await Promise.all([
      getRepositoryOverview(),
      getGitHubInstallationUrl("/repositories"),
    ]);

    repositories = overview.repositories;
    installationUrl = installUrl;
  } catch {
    errorMessage = "Unable to load repositories.";
  }

  const avgHealth = repositories.length > 0
    ? Math.round(repositories.reduce((sum, repository) => sum + repository.healthScore, 0) / repositories.length)
    : 0;
  const avgRisk = repositories.length > 0
    ? Math.round(repositories.reduce((sum, repository) => sum + repository.riskScore, 0) / repositories.length)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-[color:var(--app-danger)]/40 bg-[color:var(--app-danger)]/10 px-4 py-3 text-sm text-[color:var(--app-fg)]">
          {errorMessage}
        </div>
      ) : null}

      <Card>
        <SectionTitle title="Repository onboarding" subtitle="How to get value fast" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { title: "Connect a repository", body: "Start with the highest-risk service to establish baseline review coverage." },
            { title: "Tune strictness", body: "Adjust policy per team to reduce noise while preserving security coverage." },
            { title: "Watch trends", body: "Use health and risk deltas to spot regressions before merge." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-(--app-border) px-4 py-4 transition hover:bg-(--app-panel-strong)/25">
              <div className="text-sm font-semibold text-foreground">{item.title}</div>
              <div className="mt-2 text-sm text-(--app-muted)">{item.body}</div>
            </div>
          ))}
        </div>
        {installationUrl ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={installationUrl}
              className="rounded-full bg-(--app-accent) px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-accent)"
            >
              Connect GitHub App
            </a>
            <div className="text-sm text-(--app-muted)">
              Install the app to discover repositories and start syncing reviews.
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-(--app-muted)">Portfolio health</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{avgHealth}</div>
        </div>
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-(--app-muted)">Average risk</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{avgRisk}</div>
        </div>
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-(--app-muted)">Active repositories</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{repositories.length}</div>
        </div>
      </div>

      <Card>
        <SectionTitle title="Repositories" subtitle="Portfolio health" />
        <div className="mt-4 divide-y divide-(--app-border)">
          {repositories.length === 0 ? (
            <div className="rounded-2xl border border-(--app-border) bg-(--app-panel-strong)/20 px-4 py-8 text-center transition hover:bg-(--app-panel-strong)/35">
              <div className="text-sm font-semibold text-foreground">No repositories connected</div>
              <div className="mt-2 text-sm text-(--app-muted)">
                Connect your first repo to begin AI review coverage and health tracking.
              </div>
              {installationUrl ? (
                <div className="mt-4">
                  <a
                    href={installationUrl}
                    className="inline-flex rounded-full bg-(--app-accent) px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-accent)"
                  >
                    Install GitHub App
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
          {repositories.map((repo) => (
            <Link
              key={repo.id}
              href={`/repositories/${repo.id}`}
              aria-label={`Open repository ${repo.name}`}
              className="flex flex-col gap-4 rounded-2xl py-4 transition hover:-translate-y-px hover:bg-(--app-panel-strong)/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-accent) sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="w-full max-w-lg">
                <div className="text-sm font-semibold text-foreground">{repo.fullName}</div>
                <div className="text-xs text-(--app-muted)">
                  {repo.language ?? "Unknown language"} · {repo.syncState} · Synced {formatTimestamp(repo.lastSyncedAt)}
                </div>
                <div className="mt-2 grid gap-2 text-[11px] text-(--app-muted)">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span>Health</span>
                      <span>{repo.healthScore}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[color:var(--app-panel-strong)]">
                      <div className="h-full rounded-full bg-[color:var(--app-success)]" style={{ width: `${repo.healthScore}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span>Risk</span>
                      <span>{repo.riskScore}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-(--app-panel-strong)">
                      <div className="h-full rounded-full bg-(--app-danger)" style={{ width: `${repo.riskScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <Badge label={`${repo.healthScore} health`} tone={toneForHealth(repo.healthScore)} />
                <Badge label={`Risk ${repo.riskScore}`} tone={toneForRisk(repo.riskScore)} />
                <Badge label={`${repo.confidenceScore}% confidence`} tone={repo.confidenceScore > 70 ? "good" : "warn"} />
                <Badge label={repo.syncState} tone={repo.syncState === "ready" ? "good" : repo.syncState === "error" ? "bad" : "warn"} />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
