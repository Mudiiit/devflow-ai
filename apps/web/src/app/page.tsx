import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12 sm:px-10">
      <div className="glass-panel overflow-hidden px-6 py-8 sm:px-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.9fr] lg:items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">DevFlow AI</div>
            <h1 className="brand-title mt-3 text-4xl font-semibold leading-tight text-[color:var(--app-fg)] sm:text-5xl">
              Enterprise AI code review, ready for production teams.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-[color:var(--app-muted)] sm:text-base">
              Centralize repository risk, AI findings, and team notifications in one mission control. Built for launch-readiness, observability, and recruiter-level demo impact.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full bg-[color:var(--app-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Open dashboard
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[color:var(--app-border)] px-5 py-3 text-sm font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-panel-strong)]"
              >
                Continue with GitHub
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              ["Review SLA", "96.4%"],
              ["Repositories monitored", "42"],
              ["Critical issues blocked", "128"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-panel)]/70 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-[color:var(--app-fg)]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
