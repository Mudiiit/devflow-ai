"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/jobs", label: "Job Monitor" },
  { href: "/repositories", label: "Repositories" },
  { href: "/pull-requests", label: "Pull Requests" },
  { href: "/reviews", label: "Review History" },
  { href: "/notifications", label: "Inbox" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings/organization", label: "Settings" },
];

const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen w-full px-6 py-6 sm:px-10">
      <div className="app-shell-gradient grid min-h-[90vh] grid-cols-1 gap-6 px-4 py-5 sm:grid-cols-[260px_1fr] sm:gap-8 sm:px-8">
        <aside className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
                DevFlow AI
              </div>
              <h1 className="brand-title text-2xl font-semibold text-[color:var(--app-fg)]">
                Mission Control
              </h1>
            </div>
            <div className="hidden rounded-full bg-[color:var(--app-accent)] px-2 py-1 text-xs font-semibold uppercase text-white sm:block">
              Pro
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const active =
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-[color:var(--app-accent)] text-white shadow-lg"
                      : "text-[color:var(--app-muted)] hover:bg-[color:var(--app-panel-strong)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="glass-panel flex flex-col gap-3 px-4 py-4 text-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
              Status
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--app-fg)]">AI Queue</span>
              <span className="rounded-full bg-[color:var(--app-accent-2)] px-2 py-1 text-xs font-semibold text-[color:var(--app-fg)]">
                3 jobs
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--app-fg)]">Risk Pulse</span>
              <span className="text-xs font-semibold text-[color:var(--app-danger)]">Elevated</span>
            </div>
          </div>

          <div className="glass-panel px-4 py-4 text-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
              Workspace
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold text-[color:var(--app-fg)]">Acme Labs</span>
              <span className="text-xs text-[color:var(--app-muted)]">Owner</span>
            </div>
            <button className="mt-3 w-full rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)] hover:border-[color:var(--app-accent)]">
              Switch workspace
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-[color:var(--app-accent)]"></div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
                  Live insights
                </div>
                <div className="text-lg font-semibold text-[color:var(--app-fg)]">
                  Review operations at a glance
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-fg)]">
                Export
              </button>
              <button className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-white">
                New review
              </button>
              <div className="flex items-center gap-3 rounded-full border border-[color:var(--app-border)] px-3 py-2">
                <div className="h-6 w-6 rounded-full bg-[color:var(--app-accent-2)]"></div>
                <div className="text-xs text-[color:var(--app-muted)]">ava@devflow.ai</div>
              </div>
            </div>
          </header>

          <main className="flex-1 animate-rise">{children}</main>
        </div>
      </div>
    </div>
  );
}
