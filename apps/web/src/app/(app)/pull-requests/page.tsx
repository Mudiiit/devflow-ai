import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";

const pullRequests = [
  { id: "pr_481", title: "Webhook retry tuning", repo: "acme/platform-api", risk: 28, state: "open" },
  { id: "pr_117", title: "PCI compliance fixes", repo: "acme/payments-service", risk: 46, state: "open" },
];

export default function PullRequestsPage() {
  return (
    <Card>
      <SectionTitle title="Pull requests" subtitle="Active review queue" />
      <div className="mt-4 space-y-3">
        {pullRequests.map((pr) => (
          <Link
            key={pr.id}
            href={`/pull-requests/${pr.id}`}
            className="flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] px-4 py-3"
          >
            <div>
              <div className="text-sm font-semibold text-[color:var(--app-fg)]">{pr.title}</div>
              <div className="text-xs text-[color:var(--app-muted)]">{pr.repo}</div>
            </div>
            <div className="flex items-center gap-3">
              <Badge label={`Risk ${pr.risk}`} tone={pr.risk > 40 ? "bad" : "warn"} />
              <Badge label={pr.state} />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
