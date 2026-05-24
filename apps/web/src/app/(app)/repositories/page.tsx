import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";

const repositories = [
  { id: "1", name: "acme/platform-api", language: "TypeScript", health: 88, risk: 26, syncState: "ready", prs: 38, trend: 6 },
  { id: "2", name: "acme/payments-service", language: "Go", health: 92, risk: 18, syncState: "ready", prs: 22, trend: 3 },
  { id: "3", name: "acme/ops-tooling", language: "Python", health: 79, risk: 41, syncState: "syncing", prs: 19, trend: -2 },
];

const avgHealth = Math.round(
  repositories.reduce((sum, repository) => sum + repository.health, 0) / repositories.length,
);

const avgRisk = Math.round(
  repositories.reduce((sum, repository) => sum + repository.risk, 0) / repositories.length,
);

export default function RepositoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="Repository onboarding" subtitle="How to get value fast" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { title: "Connect a repository", body: "Start with the highest-risk service to establish baseline review coverage." },
            { title: "Tune strictness", body: "Adjust policy per team to reduce noise while preserving security coverage." },
            { title: "Watch trends", body: "Use health and risk deltas to spot regressions before merge." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-4 transition hover:bg-[color:var(--app-panel-strong)]/25">
              <div className="text-sm font-semibold text-[color:var(--app-fg)]">{item.title}</div>
              <div className="mt-2 text-sm text-[color:var(--app-muted)]">{item.body}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Portfolio health</div>
          <div className="mt-2 text-3xl font-semibold text-[color:var(--app-fg)]">{avgHealth}</div>
        </div>
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Average risk</div>
          <div className="mt-2 text-3xl font-semibold text-[color:var(--app-fg)]">{avgRisk}</div>
        </div>
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Active repositories</div>
          <div className="mt-2 text-3xl font-semibold text-[color:var(--app-fg)]">{repositories.length}</div>
        </div>
      </div>

      <Card>
        <SectionTitle title="Repositories" subtitle="Portfolio health" />
        <div className="mt-4 divide-y divide-[color:var(--app-border)]">
          {repositories.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-8 text-center">
              <div className="text-sm font-semibold text-[color:var(--app-fg)]">No repositories connected</div>
              <div className="mt-2 text-sm text-[color:var(--app-muted)]">
                Connect your first repo to begin AI review coverage and health tracking.
              </div>
            </div>
          ) : null}
          {repositories.map((repo) => (
            <Link
              key={repo.id}
              href={`/repositories/${repo.id}`}
              className="flex flex-col gap-4 rounded-2xl py-4 transition hover:bg-[color:var(--app-panel-strong)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="w-full max-w-lg">
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{repo.name}</div>
                <div className="text-xs text-[color:var(--app-muted)]">{repo.language} · {repo.prs} active PRs</div>
                <div className="mt-2 grid gap-2 text-[11px] text-[color:var(--app-muted)]">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span>Health</span>
                      <span>{repo.health}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[color:var(--app-panel-strong)]">
                      <div className="h-full rounded-full bg-[color:var(--app-success)]" style={{ width: `${repo.health}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span>Risk</span>
                      <span>{repo.risk}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[color:var(--app-panel-strong)]">
                      <div className="h-full rounded-full bg-[color:var(--app-danger)]" style={{ width: `${repo.risk}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <Badge label={`${repo.health} health`} tone={repo.health > 85 ? "good" : "warn"} />
                <Badge label={`Risk ${repo.risk}`} tone={repo.risk > 35 ? "bad" : "warn"} />
                <Badge label={`${repo.trend >= 0 ? "+" : ""}${repo.trend} wk`} tone={repo.trend >= 0 ? "good" : "warn"} />
                <Badge label={repo.syncState} />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
