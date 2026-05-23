import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";

const reviews = [
  { id: "rvw_1024", repo: "acme/platform-api", status: "completed", risk: 34, severity: "warning" },
  { id: "rvw_1025", repo: "acme/payments-service", status: "completed", risk: 18, severity: "info" },
  { id: "rvw_1026", repo: "acme/ops-tooling", status: "in_progress", risk: 52, severity: "critical" },
];

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
              className="flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{review.repo}</div>
                <div className="text-xs text-[color:var(--app-muted)]">{review.id}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge label={`Risk ${review.risk}`} tone={review.risk > 40 ? "bad" : "warn"} />
                <Badge label={review.severity} tone={review.severity === "critical" ? "bad" : "warn"} />
                <Badge label={review.status} />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
