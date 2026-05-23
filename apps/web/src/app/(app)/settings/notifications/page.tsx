import { Card, SectionTitle } from "@/components/ui";

export default function NotificationSettingsPage() {
  return (
    <Card>
      <SectionTitle title="Notifications" subtitle="Delivery preferences" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          { label: "Review completed", value: "Email + Slack" },
          { label: "High-risk finding", value: "Slack only" },
          { label: "Integration errors", value: "Email" },
          { label: "Weekly digest", value: "Enabled" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">{item.label}</div>
            <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">{item.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
