import { Card, SectionTitle } from "@/components/ui";

const teamMembers = [
  { name: "Ava Stone", role: "Workspace owner", email: "ava@acme.dev" },
  { name: "Ken Mori", role: "Security lead", email: "ken@acme.dev" },
  { name: "Leah Chen", role: "Developer experience", email: "leah@acme.dev" },
];

export default function OrganizationSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle title="Organization" subtitle="Workspace configuration" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Workspace name", value: "Acme Labs" },
            { label: "Plan", value: "Enterprise" },
            { label: "Security contact", value: "security@acme.dev" },
            { label: "Default strictness", value: "Moderate" },
          ].map((field) => (
            <div key={field.label} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 transition hover:bg-[color:var(--app-panel-strong)]/25">
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">{field.label}</div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">{field.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Team members" subtitle="Access and roles" />
        <div className="mt-4 grid gap-3">
          {teamMembers.map((member) => (
            <div key={member.email} className="flex flex-col gap-3 rounded-2xl border border-[color:var(--app-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{member.name}</div>
                <div className="text-xs text-[color:var(--app-muted)]">{member.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[color:var(--app-panel-strong)] px-3 py-1 text-xs font-semibold text-[color:var(--app-fg)]">
                  {member.role}
                </span>
                <button className="rounded-full border border-[color:var(--app-border)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Governance" subtitle="Demo-ready guidance" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { label: "Invite policy", value: "Owner approval" },
            { label: "Review strictness", value: "Moderate" },
            { label: "Audit retention", value: "90 days" },
          ].map((field) => (
            <div key={field.label} className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3 transition hover:bg-[color:var(--app-panel-strong)]/25">
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">{field.label}</div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">{field.value}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
