import { Badge, Card, SectionTitle, Sparkline } from "@/components/ui";

const fileHeatmap = [32, 12, 44, 18, 26, 30, 12, 8, 22, 38, 16, 28];

export default function RepositoryDetailPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="acme/platform-api" subtitle="Repository health" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="glass-panel px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Health score</div>
            <div className="mt-2 text-3xl font-semibold text-[color:var(--app-fg)]">88</div>
            <Badge label="Stable" tone="good" />
          </div>
          <div className="glass-panel px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Risk trend</div>
            <Sparkline points={[28, 24, 22, 25, 20, 18, 21, 19]} />
          </div>
          <div className="glass-panel px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Active PRs</div>
            <div className="mt-2 text-3xl font-semibold text-[color:var(--app-fg)]">12</div>
            <Badge label="2 high risk" tone="bad" />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Risk heatmap" subtitle="Files with elevated findings" />
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {fileHeatmap.map((value, index) => (
            <div
              key={index}
              className="h-16 rounded-2xl border border-[color:var(--app-border)]"
              style={{
                background: `linear-gradient(135deg, rgba(11, 95, 107, ${value / 80}), rgba(240, 180, 60, ${value / 120}))`,
              }}
            ></div>
          ))}
        </div>
      </Card>
    </div>
  );
}
