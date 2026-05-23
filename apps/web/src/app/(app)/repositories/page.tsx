import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";

const repositories = [
  { id: "1", name: "acme/platform-api", language: "TypeScript", health: 88, risk: 26, syncState: "ready" },
  { id: "2", name: "acme/payments-service", language: "Go", health: 92, risk: 18, syncState: "ready" },
  { id: "3", name: "acme/ops-tooling", language: "Python", health: 79, risk: 41, syncState: "syncing" },
];

export default function RepositoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="Repositories" subtitle="Portfolio health" />
        <div className="mt-4 divide-y divide-[color:var(--app-border)]">
          {repositories.map((repo) => (
            <Link
              key={repo.id}
              href={`/repositories/${repo.id}`}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div>
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{repo.name}</div>
                <div className="text-xs text-[color:var(--app-muted)]">{repo.language}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge label={`${repo.health} health`} tone={repo.health > 85 ? "good" : "warn"} />
                <Badge label={`Risk ${repo.risk}`} tone={repo.risk > 35 ? "bad" : "warn"} />
                <Badge label={repo.syncState} />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
