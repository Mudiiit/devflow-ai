import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";

const reviews = [
  { id: "rvw_1024", repo: "acme/platform-api", status: "completed", risk: 34, severity: "warning" },
  { id: "rvw_1025", repo: "acme/payments-service", status: "completed", risk: 18, severity: "info" },
  { id: "rvw_1026", repo: "acme/ops-tooling", status: "in_progress", risk: 52, severity: "critical" },
];

function statusTone(status: string): "neutral" | "good" | "warn" | "bad" {
  if (status === "completed") {
    return "good";
  }

  if (status === "in_progress") {
    return "warn";
  }

  return "neutral";
}

export default function ReviewHistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="Review history" subtitle="Latest AI runs" />
        <div className="mt-4 space-y-3">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/reviews/${review.id}`}
              className="flex flex-col gap-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-panel)]/55 px-4 py-4 transition hover:-translate-y-px hover:bg-[color:var(--app-panel-strong)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{review.repo}</div>
                <div className="text-xs text-[color:var(--app-muted)]">{review.id}</div>
                <div className="mt-3 max-w-72">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-[color:var(--app-muted)]">
                    <span>Risk</span>
                    <span>{review.risk}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[color:var(--app-panel-strong)]">
                    <div
                      className={`h-full rounded-full ${review.risk > 40 ? "bg-[color:var(--app-danger)]" : "bg-[color:var(--app-accent)]"}`}
                      style={{ width: `${Math.min(review.risk, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge label={`Risk ${review.risk}`} tone={review.risk > 40 ? "bad" : "warn"} />
                <Badge label={review.severity} tone={review.severity === "critical" ? "bad" : review.severity === "warning" ? "warn" : "good"} />
                <Badge label={review.status.replace("_", " ")} tone={statusTone(review.status)} />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
