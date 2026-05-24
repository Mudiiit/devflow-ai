import { Card, SectionTitle, Sparkline, StatCard, Badge } from "@/components/ui";
import { formatNumber } from "@/lib/format";

const riskSeries = [18, 24, 21, 30, 26, 28, 22, 24, 21, 18, 20, 16, 14];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Repositories" value={formatNumber(42)} delta="+3 this week" tone="good" />
        <StatCard label="Open PRs" value={formatNumber(128)} delta="+12 active" tone="warn" />
        <StatCard label="Reviews" value={formatNumber(312)} delta="+28 today" tone="good" />
        <StatCard label="Risk Score" value="34" delta="-6" tone="good" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="flex flex-col gap-4">
            <SectionTitle title="Risk pulse" subtitle="Last 14 days" />
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <div className="glass-panel flex flex-col justify-between gap-4 px-4 py-4">
                <div className="text-sm text-[color:var(--app-muted)]">Average risk trend</div>
                <div className="text-3xl font-semibold text-[color:var(--app-fg)]">24</div>
                <Sparkline points={riskSeries} />
              </div>
              <div className="grid gap-3">
                {[
                  { label: "Critical", value: 6, tone: "bad" },
                  { label: "Warning", value: 18, tone: "warn" },
                  { label: "Info", value: 42, tone: "good" },
                ].map((item) => (
                  <div key={item.label} className="glass-panel flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[color:var(--app-muted)]">{item.label}</span>
                    <Badge label={`${item.value}`} tone={item.tone as "good" | "warn" | "bad"} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Queue status" subtitle="Live workers" />
          <div className="mt-4 grid gap-3">
            {[
              { label: "Queued", value: 3 },
              { label: "Analyzing", value: 2 },
              { label: "Summarizing", value: 1 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
                <span className="text-sm text-[color:var(--app-muted)]">{item.label}</span>
                <span className="text-sm font-semibold text-[color:var(--app-fg)]">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Top repositories" subtitle="Health score" />
          <div className="mt-4 space-y-3">
            {[
              { name: "acme/payments-service", score: 92, risk: 18 },
              { name: "acme/platform-api", score: 88, risk: 26 },
              { name: "acme/mobile", score: 84, risk: 32 },
              { name: "acme/ops-tooling", score: 79, risk: 41 },
            ].map((repo) => (
              <div key={repo.name} className="flex flex-col gap-3 rounded-2xl border border-[color:var(--app-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">{repo.name}</div>
                  <div className="text-xs text-[color:var(--app-muted)]">Risk score {repo.risk}</div>
                </div>
                <Badge label={`${repo.score} health`} tone={repo.score > 85 ? "good" : "warn"} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Recent activity" subtitle="Last 24 hours" />
          <div className="mt-4 space-y-3">
            {[
              { title: "Review completed", meta: "acme/platform-api #482" },
              { title: "High-risk finding", meta: "acme/payments-service #117" },
              { title: "Repository synced", meta: "acme/mobile" },
              { title: "Review queued", meta: "acme/ops-tooling #58" },
            ].map((event) => (
              <div key={event.title} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{event.title}</div>
                <div className="text-xs text-[color:var(--app-muted)]">{event.meta}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
