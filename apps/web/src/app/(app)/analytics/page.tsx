import { Card, SectionTitle, Sparkline, Badge } from "@/components/ui";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="Analytics" subtitle="Signal distribution" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
    </div>
  );
}
