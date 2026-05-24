"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const tabs = [
  { href: "/settings/organization", label: "Organization" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/ai", label: "AI Provider" },
  { href: "/settings/repositories", label: "Repositories" },
  { href: "/settings/notifications", label: "Notifications" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Settings sections">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={pathname === tab.href ? "page" : undefined}
            className={classNames(
              "rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-fg)] whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]",
              pathname === tab.href
                ? "bg-[color:var(--app-accent)] text-white"
                : "hover:bg-[color:var(--app-panel-strong)]",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
