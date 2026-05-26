"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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

type CommandItem = {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly run: () => void;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const commandItems = useMemo<CommandItem[]>(
    () => [
      ...navItems.map((item) => ({
        id: `nav:${item.href}`,
        label: `Go to ${item.label}`,
        hint: item.href,
        run: () => {
          router.push(item.href);
          setCommandOpen(false);
          setCommandQuery("");
        },
      })),
      {
        id: "action:new-review",
        label: "Start new review",
        hint: "shortcut: n",
        run: () => {
          router.push("/pull-requests");
          setCommandOpen(false);
          setCommandQuery("");
        },
      },
      {
        id: "action:open-inbox",
        label: "Open notification inbox",
        hint: "shortcut: ctrl/cmd+shift+3",
        run: () => {
          router.push("/notifications");
          setCommandOpen(false);
          setCommandQuery("");
        },
      },
    ],
    [router],
  );

  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return commandItems;
    }

    return commandItems.filter((item) =>
      `${item.label} ${item.hint}`.toLowerCase().includes(query),
    );
  }, [commandItems, commandQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((previous) => !previous);
        return;
      }

      if (isMeta && event.shiftKey && event.key === "1") {
        event.preventDefault();
        router.push("/dashboard");
        return;
      }

      if (isMeta && event.shiftKey && event.key === "2") {
        event.preventDefault();
        router.push("/repositories");
        return;
      }

      if (isMeta && event.shiftKey && event.key === "3") {
        event.preventDefault();
        router.push("/notifications");
        return;
      }

      if (!isMeta && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "n") {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName.toLowerCase();
        const isTypingTarget = Boolean(
          tagName === "input"
          || tagName === "textarea"
          || target?.isContentEditable,
        );

        if (!isTypingTarget) {
          event.preventDefault();
          router.push("/pull-requests");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [router]);

  useEffect(() => {
    const closeNavTimer = window.setTimeout(() => {
      setMobileNavOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(closeNavTimer);
    };
  }, [pathname]);

  return (
    <div className="min-h-screen w-full px-6 py-6 sm:px-10">
      <div className="app-shell-gradient grid min-h-[90vh] grid-cols-1 gap-6 px-4 py-5 sm:grid-cols-[260px_1fr] sm:gap-8 sm:px-8">
        <aside className="hidden flex-col gap-6 sm:sticky sm:top-6 sm:flex sm:self-start">
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

          <nav className="flex flex-wrap gap-2 sm:flex-col" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active =
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-2xl px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]",
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
            <button className="mt-3 w-full rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:border-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
              Switch workspace
            </button>
          </div>
        </aside>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 bg-black/30 px-4 py-4 sm:hidden" onClick={() => setMobileNavOpen(false)}>
            <aside
              className="flex h-full flex-col gap-6 overflow-auto rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-bg)] p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
                    DevFlow AI
                  </div>
                  <h1 className="brand-title text-2xl font-semibold text-[color:var(--app-fg)]">
                    Mission Control
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-full border border-[color:var(--app-border)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
                  aria-label="Close navigation"
                >
                  Close
                </button>
              </div>

              <nav className="grid gap-2" aria-label="Primary navigation">
                {navItems.map((item) => {
                  const active =
                    pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        "rounded-2xl px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]",
                        active
                          ? "bg-[color:var(--app-accent)] text-white shadow-lg"
                          : "text-[color:var(--app-muted)] hover:bg-[color:var(--app-panel-strong)]",
                      )}
                      onClick={() => setMobileNavOpen(false)}
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
                <button className="mt-3 w-full rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:border-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
                  Switch workspace
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="h-10 w-10 rounded-2xl bg-[color:var(--app-accent)] text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:hidden"
                aria-label="Open navigation menu"
              >
                ☰
              </button>
              <div className="hidden h-10 w-10 rounded-2xl bg-[color:var(--app-accent)] sm:block"></div>
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
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setCommandOpen(true);
                }}
                className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
                aria-label="Open command palette"
              >
                Command
                <span className="ml-2 text-[10px] text-[color:var(--app-muted)]">Ctrl/Cmd+K</span>
              </button>
              <button className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-fg)] transition hover:bg-[color:var(--app-panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
                Export
              </button>
              <button className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]">
                New review
              </button>
              <div className="flex items-center gap-3 rounded-full border border-[color:var(--app-border)] px-3 py-2">
                <div className="h-6 w-6 rounded-full bg-[color:var(--app-accent-2)]"></div>
                <div className="text-xs text-[color:var(--app-muted)]">ava@devflow.ai</div>
              </div>
            </div>
          </header>

          <main id="main-content" className="flex-1 animate-rise">{children}</main>
        </div>
      </div>

      {commandOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 py-20"
          onClick={() => {
            setCommandOpen(false);
            setCommandQuery("");
          }}
        >
          <div
            className="glass-panel w-full max-w-2xl px-4 py-4"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setCommandOpen(false);
                  setCommandQuery("");
                }

                if (event.key === "Enter" && filteredCommands[0]) {
                  filteredCommands[0].run();
                }
              }}
              placeholder="Type a command or route..."
              className="w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-panel)] px-3 py-2 text-sm text-[color:var(--app-fg)] outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]"
            />

            <div className="mt-3 max-h-[320px] space-y-2 overflow-auto">
              {filteredCommands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={command.run}
                  className="flex w-full items-center justify-between rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-left text-sm transition hover:bg-[color:var(--app-panel-strong)]"
                >
                  <span className="text-[color:var(--app-fg)]">{command.label}</span>
                  <span className="text-xs text-[color:var(--app-muted)]">{command.hint}</span>
                </button>
              ))}

              {filteredCommands.length === 0 ? (
                <div className="rounded-xl border border-[color:var(--app-border)] px-3 py-4 text-sm text-[color:var(--app-muted)]">
                  No command found.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
