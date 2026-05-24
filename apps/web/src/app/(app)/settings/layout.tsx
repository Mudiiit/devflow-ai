import Link from "next/link";

const tabs = [
  { href: "/settings/organization", label: "Organization" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/ai", label: "AI Provider" },
  { href: "/settings/repositories", label: "Repositories" },
  { href: "/settings/notifications", label: "Notifications" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-fg)]"
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
