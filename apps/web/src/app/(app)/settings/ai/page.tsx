import { Card, SectionTitle, Badge } from "@/components/ui";

export default function AISettingsPage() {
  return (
    <Card>
      <SectionTitle title="AI provider" subtitle="Model configuration" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Default provider</div>
          <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">OpenAI · gpt-4.1-mini</div>
          <Badge label="Fallback: Claude" />
        </div>
        <div className="rounded-2xl border border-[color:var(--app-border)] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">Review strictness</div>
          <div className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">Balanced (50)</div>
        </div>
      </div>
    </Card>
  );
}
