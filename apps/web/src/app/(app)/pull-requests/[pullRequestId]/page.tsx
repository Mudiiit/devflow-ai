import { Badge, Card, SectionTitle } from "@/components/ui";

const findings = [
  { title: "Token refresh missing retry", severity: "critical", confidence: 92, file: "src/auth/session.ts" },
  { title: "Race in webhook handler", severity: "warning", confidence: 74, file: "src/webhooks/github.ts" },
  { title: "N+1 query in review history", severity: "warning", confidence: 66, file: "src/reviews/list.ts" },
];

export default function PullRequestDetailPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="PR #482" subtitle="acme/platform-api" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge label="Risk 34" tone="warn" />
          <Badge label="Confidence 78" tone="good" />
          <Badge label="Review in progress" />
        </div>
        <p className="mt-4 text-sm text-[color:var(--app-muted)]">
          This pull request introduces webhook ingestion refinements and new retry policies for AI provider calls.
        </p>
      </Card>

      <Card>
        <SectionTitle title="Findings" subtitle="Grouped by severity" />
        <div className="mt-4 space-y-3">
          {findings.map((finding) => (
            <div key={finding.title} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{finding.title}</div>
                <Badge label={`${finding.severity} · ${finding.confidence}%`} tone={finding.severity === "critical" ? "bad" : "warn"} />
              </div>
              <div className="text-xs text-[color:var(--app-muted)]">{finding.file}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
