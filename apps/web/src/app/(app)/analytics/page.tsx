import { Card, SectionTitle, Sparkline, Badge } from "@/components/ui";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="Operations story" subtitle="Demo-ready signals" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { label: "Fastest review path", value: "8m 12s", meta: "Median from PR open to publish" },
            { label: "Risk reduction", value: "-23%", meta: "Critical findings over the last week" },
            { label: "Follow-up rate", value: "91%", meta: "Owners acknowledged findings" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-4 transition hover:bg-[color:var(--app-panel-strong)]/25">
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold text-[color:var(--app-fg)]">{item.value}</div>
              <div className="mt-1 text-xs text-[color:var(--app-muted)]">{item.meta}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Review SLA</div>
          <div className="mt-2 text-2xl font-semibold text-[color:var(--app-fg)]">96.4%</div>
          <div className="text-xs text-[color:var(--app-muted)]">Completed under 10 min</div>
        </div>
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">MTTR</div>
          <div className="mt-2 text-2xl font-semibold text-[color:var(--app-fg)]">38m</div>
          <div className="text-xs text-[color:var(--app-muted)]">Critical findings resolution</div>
        </div>
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Worker uptime</div>
          <div className="mt-2 text-2xl font-semibold text-[color:var(--app-fg)]">99.93%</div>
          <div className="text-xs text-[color:var(--app-muted)]">Last 30 days</div>
        </div>
        <div className="glass-panel px-4 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Alert noise ratio</div>
          <div className="mt-2 text-2xl font-semibold text-[color:var(--app-fg)]">0.18</div>
          <div className="text-xs text-[color:var(--app-muted)]">Lower is better</div>
        </div>
      </div>

      <Card>
        <SectionTitle title="Analytics" subtitle="Signal distribution" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="glass-panel px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Review throughput</div>
            <div className="mt-2 text-3xl font-semibold text-[color:var(--app-fg)]">48/day</div>
            <Sparkline points={[18, 22, 20, 28, 26, 30, 35, 32, 40, 38]} />
          </div>
          <div className="glass-panel px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Severity mix</div>
            <div className="mt-4 flex gap-3">
              <Badge label="Critical 14%" tone="bad" />
              <Badge label="Warning 36%" tone="warn" />
              <Badge label="Info 50%" tone="good" />
            </div>
            <div className="mt-4 space-y-2 text-[11px] text-[color:var(--app-muted)]">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span>Critical</span>
                  <span>14%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[color:var(--app-panel-strong)]">
                  <div className="h-full w-[14%] rounded-full bg-[color:var(--app-danger)]" />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span>Warning</span>
                  <span>36%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[color:var(--app-panel-strong)]">
                  <div className="h-full w-[36%] rounded-full bg-[color:var(--app-accent-2)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Contributor activity" subtitle="Last 30 days" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { name: "Ava Stone", reviews: 42 },
            { name: "Ken Mori", reviews: 35 },
            { name: "Leah Chen", reviews: 29 },
          ].map((item) => (
            <div key={item.name} className="glass-panel px-4 py-3">
              <div className="text-sm font-semibold text-[color:var(--app-fg)]">{item.name}</div>
              <div className="text-xs text-[color:var(--app-muted)]">{item.reviews} reviews supported</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Retention and alert quality" subtitle="Production observability" />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Audit retention</div>
            <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">90 days with searchable review context</div>
            <div className="mt-2 text-sm text-[color:var(--app-muted)]">Ideal for compliance review, incident response, and demo storytelling.</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Alert quality</div>
            <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">Fewer false positives, faster acknowledgment</div>
            <div className="mt-2 text-sm text-[color:var(--app-muted)]">Tune thresholds to keep signal high without overwhelming teams.</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
