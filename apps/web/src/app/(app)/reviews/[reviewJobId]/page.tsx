import { Badge, Card, SectionTitle } from "@/components/ui";

const findings = [
  { title: "Sensitive token logged", severity: "critical", confidence: 91, file: "src/logging.ts" },
  { title: "Missing retry backoff", severity: "warning", confidence: 71, file: "src/worker/retry.ts" },
  { title: "Unhandled null payload", severity: "warning", confidence: 63, file: "src/webhooks/parser.ts" },
];

export default function ReviewDetailPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="Review details" subtitle="rvw_1024" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge label="Risk 34" tone="warn" />
          <Badge label="Confidence 78" tone="good" />
          <Badge label="3 findings" />
          <Badge label="Completed" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
          >
            Retry review
          </button>
          <button
            type="button"
            className="rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
          >
            Export report
          </button>
          <button
            type="button"
            className="rounded-xl bg-[color:var(--app-accent)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
          >
            Open GitHub review
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Findings" subtitle="Filtered by severity" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge label="All" />
          <Badge label="Critical" tone="bad" />
          <Badge label="Warning" tone="warn" />
          <Badge label="Confidence > 70%" />
        </div>
        <div className="mt-4 space-y-3">
          {findings.map((finding) => (
            <div key={finding.title} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{finding.title}</div>
                <Badge label={`${finding.severity} · ${finding.confidence}%`} tone={finding.severity === "critical" ? "bad" : "warn"} />
              </div>
              <div className="text-xs text-[color:var(--app-muted)]">{finding.file}</div>
              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between text-[11px] text-[color:var(--app-muted)]">
                  <span>AI confidence</span>
                  <span>{finding.confidence}%</span>
                </div>
                <div className="h-2 rounded-full bg-[color:var(--app-panel-strong)]">
                  <div
                    className={`h-full rounded-full ${finding.severity === "critical" ? "bg-[color:var(--app-danger)]" : "bg-[color:var(--app-accent)]"}`}
                    style={{ width: `${finding.confidence}%` }}
                  />
                </div>
              </div>
              <div className="mt-2 rounded-xl bg-[color:var(--app-panel-strong)] px-3 py-2 text-xs text-[color:var(--app-muted)]">
                Diff viewer hook: open in DevFlow diff viewer
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
