import { Badge, Card, SectionTitle } from "@/components/ui";

const repoSettings = [
  { name: "acme/platform-api", strictness: 60, autoReview: true },
  { name: "acme/payments-service", strictness: 72, autoReview: true },
  { name: "acme/ops-tooling", strictness: 48, autoReview: false },
];

export default function RepositorySettingsPage() {
  return (
    <Card>
      <SectionTitle title="Repository rules" subtitle="Policy overrides" />
      <div className="mt-4 space-y-3">
        {repoSettings.map((repo) => (
          <div key={repo.name} className="flex items-center justify-between rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[color:var(--app-fg)]">{repo.name}</div>
              <div className="text-xs text-[color:var(--app-muted)]">Strictness {repo.strictness}</div>
            </div>
            <Badge label={repo.autoReview ? "Auto-review" : "Manual"} tone={repo.autoReview ? "good" : "warn"} />
          </div>
        ))}
      </div>
    </Card>
  );
}
