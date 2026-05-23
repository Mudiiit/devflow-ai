import { Card, SectionTitle } from "@/components/ui";

export default function OrganizationSettingsPage() {
  return (
    <Card>
      <SectionTitle title="Organization" subtitle="Workspace configuration" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          { label: "Workspace name", value: "Acme Labs" },
          { label: "Plan", value: "Enterprise" },
          { label: "Security contact", value: "security@acme.dev" },
          { label: "Default strictness", value: "Moderate" },
        ].map((field) => (
          <div key={field.label} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">{field.label}</div>
            <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">{field.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
